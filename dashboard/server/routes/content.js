const express = require('express');
const path = require('path');
const archiver = require('archiver');
const auth = require('../middleware/auth');
const { listPacks, getPackFiles, getFilePath, getContentPacksDir } = require('../services/contentLister');
const { getSheetNames, getSheetData, getKeywords, getTrends } = require('../services/excelParser');
const { getAgentState } = require('../services/stateWatcher');

const router = express.Router();

// ============================================================================
// GEMINI API KEY MANAGEMENT
// ============================================================================
router.get('/gemini-status', auth, async (req, res) => {
  try {
    const geminiPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/gemini_client.js');
    // Clear require cache to get fresh status
    delete require.cache[require.resolve(geminiPath)];
    const { getApiKeyStatus, testApiKey } = require(geminiPath);
    const status = getApiKeyStatus();

    // If configured, run a quick test to check if key actually works
    if (status.configured) {
      try {
        const testResult = await testApiKey();
        status.test = testResult;
        if (!testResult.ok) {
          status.error = testResult;
        }
      } catch (e) {
        status.test = { ok: false, error: "TEST_FAILED", message: e.message };
      }
    }

    res.json(status);
  } catch (err) {
    res.json({ configured: false, key: null, error: { type: "LOAD_ERROR", message: err.message } });
  }
});

router.post('/gemini-key', auth, (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return res.status(400).json({ error: 'API Key invalida' });
    }

    // Update .env file
    const envPath = path.resolve(__dirname, '../../.env');
    const fs = require('fs');
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${apiKey.trim()}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${apiKey.trim()}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');

    // Also set in process env for immediate effect
    process.env.GEMINI_API_KEY = apiKey.trim();

    // Clear module cache so gemini_client picks up new key
    const geminiPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/gemini_client.js');
    delete require.cache[require.resolve(geminiPath)];

    res.json({ success: true, message: 'API Key configurada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// MULTI-AI PROVIDER MANAGEMENT
// ============================================================================
router.get('/ai-status', auth, async (req, res) => {
  try {
    const aiPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/ai_client.js');
    delete require.cache[require.resolve(aiPath)];
    const { getAllProvidersStatus } = require(aiPath);
    const status = await getAllProvidersStatus();
    res.json(status);
  } catch (err) {
    res.json({ providers: {}, activeCount: 0, error: err.message });
  }
});

router.post('/ai-key', auth, (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider || !['gemini', 'openai', 'anthropic'].includes(provider)) {
      return res.status(400).json({ error: 'Proveedor invalido. Usa: gemini, openai, anthropic' });
    }
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return res.status(400).json({ error: 'API Key invalida' });
    }

    const aiPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/ai_client.js');
    delete require.cache[require.resolve(aiPath)];
    const { setProviderKey } = require(aiPath);
    setProviderKey(provider, apiKey.trim());

    // Also clear gemini_client cache if gemini
    if (provider === 'gemini') {
      const geminiPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/gemini_client.js');
      delete require.cache[require.resolve(geminiPath)];
    }

    res.json({ success: true, message: `API Key de ${provider} configurada correctamente` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/ai-key/:provider', auth, (req, res) => {
  try {
    const { provider } = req.params;
    if (!['gemini', 'openai', 'anthropic'].includes(provider)) {
      return res.status(400).json({ error: 'Proveedor invalido' });
    }

    const aiPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/ai_client.js');
    delete require.cache[require.resolve(aiPath)];
    const { removeProviderKey } = require(aiPath);
    removeProviderKey(provider);

    if (provider === 'gemini') {
      const geminiPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/gemini_client.js');
      delete require.cache[require.resolve(geminiPath)];
    }

    res.json({ success: true, message: `API Key de ${provider} eliminada` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CUSTOM KEYWORD CONTENT GENERATION (with real-time progress)
// ============================================================================
let generationProgress = { percent: 0, message: '', detail: '', active: false };

router.get('/generate-progress', auth, (req, res) => {
  res.json(generationProgress);
});

router.post('/generate-custom', auth, async (req, res) => {
  try {
    const { keyword, platforms } = req.body;
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
      return res.status(400).json({ error: 'Keyword requerido (mínimo 2 caracteres)' });
    }
    const validPlatforms = (platforms || ['tiktok', 'instagram', 'facebook'])
      .filter(p => ['tiktok', 'instagram', 'facebook'].includes(p.toLowerCase()));

    // Import dynamic generator (clear cache so it picks up changes)
    const generatorPath = path.resolve(__dirname, '../../../agente contenido y rrss/scripts/dynamic_generator.js');
    delete require.cache[require.resolve(generatorPath)];
    const { generateCustomContent } = require(generatorPath);

    generationProgress = { percent: 0, message: 'Iniciando...', detail: '', active: true };

    console.log(`[Content] Generando contenido custom para: "${keyword.trim()}"`);
    const summary = await generateCustomContent(keyword.trim(), validPlatforms, (prog) => {
      generationProgress = { ...prog, active: true };
    });

    generationProgress = { percent: 100, message: 'Completado', detail: '', active: false };
    res.json(summary);
  } catch (err) {
    generationProgress = { percent: 0, message: '', detail: '', active: false };
    console.error('[Content] Error generate-custom:', err);
    res.status(500).json({ error: 'Error generando contenido: ' + err.message });
  }
});

// List custom packs
router.get('/custom-packs', auth, (req, res) => {
  try {
    const customDir = path.resolve(__dirname, '../../../agente contenido y rrss/output/custom_packs');
    const fs = require('fs');

    // Read summary
    const summaryPath = path.join(customDir, 'custom_summary.json');
    if (!fs.existsSync(summaryPath)) {
      return res.json({ packs: [], summary: null });
    }
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

    // List pack folders
    const folders = fs.readdirSync(customDir)
      .filter(f => fs.statSync(path.join(customDir, f)).isDirectory())
      .sort();

    // Build title lookup from summary ideas (index matches folder number)
    const ideasList = summary && summary.ideas ? summary.ideas : [];

    const packs = folders.map(folder => {
      const files = fs.readdirSync(path.join(customDir, folder))
        .filter(f => f.endsWith('.docx'));

      // Extract index from folder name (e.g. "01_titulo..." → 0)
      const idxMatch = folder.match(/^(\d+)_/);
      const idx = idxMatch ? parseInt(idxMatch[1], 10) - 1 : -1;
      const ideaInfo = idx >= 0 && idx < ideasList.length ? ideasList[idx] : null;
      const label = ideaInfo ? ideaInfo.titulo : folder.replace(/^\d+_/, '').replace(/_/g, ' ');

      return { folder, label, files, fileCount: files.length };
    });

    res.json({ packs, summary });
  } catch (err) {
    console.error('[Content] Error custom-packs:', err);
    res.json({ packs: [], summary: null });
  }
});

// Download custom pack file
router.get('/custom-packs/download/:folder/:file', auth, (req, res) => {
  try {
    const customDir = path.resolve(__dirname, '../../../agente contenido y rrss/output/custom_packs');
    const filePath = path.join(customDir, req.params.folder, req.params.file);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// List content packs
router.get('/packs', auth, (req, res) => {
  try {
    res.json(listPacks());
  } catch (err) {
    console.error('[Content] Error packs:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Files in a pack
router.get('/packs/:folder', auth, (req, res) => {
  try {
    const files = getPackFiles(req.params.folder);
    if (!files) return res.status(404).json({ error: 'Pack no encontrado' });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// Download single file
router.get('/download/:folder/:file', auth, (req, res) => {
  try {
    const filePath = getFilePath(req.params.folder, req.params.file);
    if (!filePath) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// Download all packs as ZIP
router.get('/download-all', auth, (req, res) => {
  try {
    const packsDir = getContentPacksDir();
    const fs = require('fs');
    if (!fs.existsSync(packsDir)) {
      return res.status(404).json({ error: 'No hay content packs disponibles' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=content_packs.zip');

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);
    archive.directory(packsDir, 'content_packs');
    archive.finalize();
  } catch (err) {
    console.error('[Content] Error download-all:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Keywords
router.get('/keywords', auth, (req, res) => {
  try {
    res.json(getKeywords());
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// Trends
router.get('/trends', auth, (req, res) => {
  try {
    const trends = getTrends();
    if (!trends) return res.status(404).json({ error: 'No hay tendencias disponibles' });
    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// Pipeline status
router.get('/pipeline-status', auth, (req, res) => {
  try {
    const state = getAgentState('content-rrss', '../agente contenido y rrss/output/pipeline_state.json');
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// Last run summary (trends used, keywords selected, etc.)
router.get('/last-run-summary', auth, (req, res) => {
  try {
    const fs = require('fs');
    const outputDir = path.resolve(__dirname, '../../../agente contenido y rrss/output');
    const trendsPath = path.join(outputDir, 'tendencias_actuales.json');
    const packsDir = path.join(outputDir, 'content_packs');

    let trends = null;
    let trendDate = null;
    if (fs.existsSync(trendsPath)) {
      trends = JSON.parse(fs.readFileSync(trendsPath, 'utf8'));
      trendDate = fs.statSync(trendsPath).mtime.toISOString();
    }

    let packCount = 0;
    let packFolders = [];
    if (fs.existsSync(packsDir)) {
      packFolders = fs.readdirSync(packsDir).filter(f =>
        fs.statSync(path.join(packsDir, f)).isDirectory()
      ).sort();
      packCount = packFolders.length;
    }

    // Extract top keywords and sources
    const topKeywords = trends?.all_keywords_ranked?.slice(0, 15)?.map(k => ({
      keyword: k.keyword,
      sources: k.sources,
      count: k.count,
    })) || [];

    const verticalCounts = {};
    if (trends?.all_keywords_ranked) {
      for (const kw of trends.all_keywords_ranked) {
        for (const v of (kw.verticals || [])) {
          verticalCounts[v] = (verticalCounts[v] || 0) + 1;
        }
      }
    }

    res.json({
      lastGenerated: trendDate,
      totalTrends: trends?.all_keywords_ranked?.length || 0,
      topKeywords,
      verticalCounts,
      packCount,
      docCount: packCount * 3,
    });
  } catch (err) {
    console.error('[Content] Error last-run-summary:', err);
    res.json({ lastGenerated: null, totalTrends: 0, topKeywords: [], verticalCounts: {}, packCount: 0, docCount: 0 });
  }
});

// Excel sheets list
router.get('/excel/sheets', auth, (req, res) => {
  try {
    res.json(getSheetNames());
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// Excel sheet data
router.get('/excel/data', auth, (req, res) => {
  try {
    const { sheet } = req.query;
    if (!sheet) return res.status(400).json({ error: 'Parámetro sheet requerido' });
    const data = getSheetData(sheet);
    if (!data) return res.status(404).json({ error: 'Hoja no encontrada' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
