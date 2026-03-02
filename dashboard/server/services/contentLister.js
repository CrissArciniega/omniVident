const fs = require('fs');
const path = require('path');
const { resolveAgentPath } = require('./stateWatcher');

const RRSS_OUTPUT = '../agente contenido y rrss/output';

function getContentPacksDir() {
  return resolveAgentPath(path.join(RRSS_OUTPUT, 'content_packs'));
}

/**
 * Load packs_summary.json if available — contains full titles + trend metadata
 */
function loadPacksSummary() {
  try {
    const summaryPath = path.join(getContentPacksDir(), 'packs_summary.json');
    if (fs.existsSync(summaryPath)) {
      const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (data && data.packs) {
        // Index by folder name for fast lookup
        const map = {};
        for (const p of data.packs) {
          map[p.folder] = p;
        }
        return map;
      }
    }
  } catch (e) {
    console.error('[ContentLister] Error loading packs_summary.json:', e.message);
  }
  return null;
}

function listPacks() {
  const dir = getContentPacksDir();
  if (!fs.existsSync(dir)) return [];

  const summaryMap = loadPacksSummary();

  return fs.readdirSync(dir)
    .filter(f => {
      const fullPath = path.join(dir, f);
      return fs.statSync(fullPath).isDirectory() && f !== '.git';
    })
    .map(folder => {
      const folderPath = path.join(dir, folder);
      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.docx'));

      // Detect platforms from filenames
      const platforms = files.map(f => {
        if (f.toLowerCase().includes('tiktok')) return 'TikTok';
        if (f.toLowerCase().includes('instagram')) return 'Instagram';
        if (f.toLowerCase().includes('facebook')) return 'Facebook';
        if (f.toLowerCase().includes('youtube')) return 'YouTube';
        if (f.toLowerCase().includes('blog')) return 'Blog';
        return 'Otro';
      });

      // Use full title from summary if available, else fallback to folder name
      const summary = summaryMap ? summaryMap[folder] : null;
      const label = summary && summary.fullTitle
        ? summary.fullTitle
        : folder.replace(/^\d+_/, '').replace(/_/g, ' ');

      return {
        folder,
        label,
        keyword: summary?.keyword || '',
        vertical: summary?.vertical || '',
        tipo: summary?.tipo || '',
        trendSources: summary?.trendSources || [],
        trendRank: summary?.trendRank || null,
        generatedWithAI: summary?.generatedWithAI || false,
        files,
        platforms: [...new Set(platforms)],
        fileCount: files.length,
      };
    })
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

function getPackFiles(folder) {
  const folderPath = path.join(getContentPacksDir(), folder);
  if (!fs.existsSync(folderPath)) return null;

  return fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.docx'))
    .map(f => {
      const stat = fs.statSync(path.join(folderPath, f));
      return {
        name: f,
        size: stat.size,
        modified: stat.mtime,
      };
    });
}

function getFilePath(folder, file) {
  const filePath = path.join(getContentPacksDir(), folder, file);
  // Prevent directory traversal
  const resolved = path.resolve(filePath);
  const base = path.resolve(getContentPacksDir());
  if (!resolved.startsWith(base)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

module.exports = { listPacks, getPackFiles, getFilePath, getContentPacksDir };
