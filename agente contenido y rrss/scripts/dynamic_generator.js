/**
 * Generador Dinámico de Ideas de Contenido
 * Toma un keyword del usuario + tendencias reales → genera ideas frescas
 * para TikTok, Instagram, Facebook con guiones, hashtags y prompts
 *
 * Usa Gemini AI para generar IDEAS y GUIONES únicos.
 * Si Gemini no está disponible, muestra error claro al usuario.
 */

const https = require("https");
const path = require("path");
const fs = require("fs");
const {
  createWordDocument, Packer,
  generateTikTokScript, generateInstagramScript, generateFacebookScript,
  generateHashtags,
} = require("./word_generator");
const { COMPETITOR_NAMES_SHORT } = require("./trend_fetcher");
const {
  generateContentIdeasAI,
  generateTikTokScriptAI, generateInstagramScriptAI, generateFacebookScriptAI,
  generateHashtagsAI, isGeminiAvailable, getApiKeyStatus, testApiKey, getLastError,
  isAIAvailable, getAvailableProviders,
} = require("./ai_client");

// ============================================================================
// PLANTILLAS DE IDEAS POR TIPO DE CONTENIDO (FALLBACK when Gemini fails)
// ============================================================================
const IDEA_TEMPLATES = {
  tiktok: [
    { tipo: "Hook viral",     tituloTpl: "POV: Descubriste que {kw} existe y ahora no puedes vivir sin esto",    prioridad: "Muy Alta" },
    { tipo: "Antes/Después",  tituloTpl: "El antes y después usando {kw} — no vas a creer la diferencia",        prioridad: "Alta" },
    { tipo: "Showcase",       tituloTpl: "Los 5 {kw} más vendidos esta semana en Mega Mayorista",                prioridad: "Alta" },
    { tipo: "Storytelling",   tituloTpl: "Así empecé a vender {kw} y hoy facturo más de $3,000/mes",             prioridad: "Muy Alta" },
    { tipo: "Hook viral",     tituloTpl: "¿De verdad funciona? Probando {kw} viral de TikTok",                   prioridad: "Alta" },
    { tipo: "Top / Ranking",  tituloTpl: "TOP 5 {kw} que NADIE conoce pero que se venden solos",                 prioridad: "Alta" },
    { tipo: "Unboxing",       tituloTpl: "UNBOXING masivo: Llegaron los {kw} nuevos a Mega Mayorista",           prioridad: "Alta" },
    { tipo: "Challenge",      tituloTpl: "RETO: Vendí {kw} por una semana y esto pasó",                          prioridad: "Muy Alta" },
    { tipo: "Comparativa",    tituloTpl: "{kw} de $5 vs {kw} de $50 — ¿Cuál es mejor?",                         prioridad: "Alta" },
    { tipo: "Tendencia",      tituloTpl: "Esto es lo más buscado en {kw} esta semana según Google",              prioridad: "Muy Alta" },
  ],
  instagram: [
    { tipo: "Carousel educativo", tituloTpl: "5 cosas que debes saber antes de comprar {kw} al por mayor",       prioridad: "Alta" },
    { tipo: "Reel",               tituloTpl: "Unboxing: Los {kw} más pedidos esta semana",                       prioridad: "Alta" },
    { tipo: "Carousel producto",  tituloTpl: "Catálogo {kw}: precios y opciones para emprendedores",             prioridad: "Media" },
    { tipo: "Reel",               tituloTpl: "Esto pasa cuando compras {kw} en Mega Mayorista vs la competencia", prioridad: "Muy Alta" },
    { tipo: "Story interactiva",  tituloTpl: "¿Cuál {kw} prefieres? A o B — Vota ahora",                        prioridad: "Alta" },
    { tipo: "Carousel tips",      tituloTpl: "3 errores al comprar {kw} al por mayor (y cómo evitarlos)",        prioridad: "Alta" },
    { tipo: "Reel tutorial",      tituloTpl: "Cómo revisar si {kw} es original antes de comprar",                prioridad: "Media" },
  ],
  facebook: [
    { tipo: "Post engagement", tituloTpl: "¿Ya probaste los nuevos {kw}? El que no lo tiene, se lo pierde",      prioridad: "Alta" },
    { tipo: "Storytelling",    tituloTpl: "TESTIMONIO: Cómo {kw} le cambió el negocio a nuestra clienta",        prioridad: "Muy Alta" },
    { tipo: "Promo",           tituloTpl: "OFERTA FLASH: {kw} con descuento especial al por mayor",              prioridad: "Alta" },
    { tipo: "Post engagement", tituloTpl: "Encuesta: ¿Cuál de estos {kw} comprarías? Vota en comentarios",       prioridad: "Media" },
    { tipo: "Live",            tituloTpl: "EN VIVO: Mostrando los nuevos {kw} que acaban de llegar",             prioridad: "Muy Alta" },
    { tipo: "Caso de éxito",   tituloTpl: "De vendedor ambulante a dueño de tienda gracias a {kw}",              prioridad: "Alta" },
    { tipo: "Educativo",       tituloTpl: "Todo lo que necesitas saber para revender {kw} con éxito",            prioridad: "Alta" },
  ],
};

// Mapeo de keywords a verticales por detección automática
const VERTICAL_KEYWORDS = {
  "Tecnología": ["gadget", "tech", "smartwatch", "celular", "audífono", "bluetooth", "led", "usb", "cargador", "power bank", "tablet", "gaming", "auricular", "parlante", "altavoz", "inalambric", "wireless", "electr", "bateria", "powerbank"],
  "Belleza": ["skincare", "maquillaje", "belleza", "crema", "sérum", "pestañ", "brocha", "cosmetic", "labial", "coreano", "facial", "cabello", "shampoo", "uñas", "perfume"],
  "Hogar": ["cocina", "hogar", "organizador", "utensilio", "decoración", "limpieza", "jardín", "mueble", "baño", "almacenamiento", "casa"],
  "Variedades": ["juguete", "fiesta", "regalo", "novedos", "viral", "tiktok", "trending", "moda", "ropa", "accesorio"],
};

function detectVertical(keyword) {
  const kw = keyword.toLowerCase();
  for (const [vertical, terms] of Object.entries(VERTICAL_KEYWORDS)) {
    if (terms.some(t => kw.includes(t))) return vertical;
  }
  return "General";
}

// ============================================================================
// FETCH TENDENCIAS PARA EL KEYWORD
// ============================================================================
function fetchSuggestions(query, source = "google") {
  return new Promise((resolve) => {
    if (source === "tiktok") {
      const url = `https://www.tiktok.com/api/search/suggest/keyword/?keyword=${encodeURIComponent(query)}&lang=es`;
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        timeout: 5000,
      }, (res) => {
        const buffers = [];
        res.on("data", (chunk) => buffers.push(chunk));
        res.on("end", () => {
          try {
            const data = Buffer.concat(buffers).toString("utf8");
            const parsed = JSON.parse(data);
            if (parsed.sug_list && Array.isArray(parsed.sug_list)) {
              resolve(parsed.sug_list.map(s => s.content).filter(Boolean));
            } else if (parsed.data && Array.isArray(parsed.data)) {
              resolve(parsed.data.map(s => s.content || s.keyword || s).filter(Boolean));
            } else resolve([]);
          } catch { resolve([]); }
        });
      });
      req.on("error", () => resolve([]));
      req.on("timeout", () => { req.destroy(); resolve([]); });
      return;
    }

    const url = source === "youtube"
      ? `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&hl=es&gl=MX`
      : `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&hl=es&gl=mx`;

    https.get(url, (res) => {
      const buffers = [];
      res.on("data", (chunk) => buffers.push(chunk));
      res.on("end", () => {
        try {
          const data = Buffer.concat(buffers).toString("latin1");
          if (source === "youtube") {
            const match = data.match(/\((.+)\)/);
            if (match) {
              const parsed = JSON.parse(match[1]);
              resolve((parsed[1] || []).map(s => s[0]));
            } else resolve([]);
          } else {
            const parsed = JSON.parse(data);
            resolve(parsed[1] || []);
          }
        } catch { resolve([]); }
      });
    }).on("error", () => resolve([]));
  });
}

async function fetchKeywordTrends(keyword) {
  const [google, youtube, tiktok] = await Promise.all([
    fetchSuggestions(keyword, "google"),
    fetchSuggestions(keyword, "youtube"),
    fetchSuggestions(keyword, "tiktok"),
  ]);

  // IMPORTANT: Only keep suggestions that are relevant to the searched keyword
  // This prevents cross-contamination (e.g., searching "power bank" returning "airpods")
  const kwLower = keyword.toLowerCase();
  const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);

  const filterRelevant = (suggestions) => {
    return suggestions.filter(s => {
      const sLower = s.toLowerCase();
      // Must contain at least one significant word from the keyword
      return kwWords.some(w => sLower.includes(w));
    });
  };

  const googleFiltered = filterRelevant(google);
  const youtubeFiltered = filterRelevant(youtube);
  const tiktokFiltered = filterRelevant(tiktok);
  const combined = [...new Set([...googleFiltered, ...youtubeFiltered, ...tiktokFiltered])];

  return {
    google: googleFiltered.slice(0, 10),
    youtube: youtubeFiltered.slice(0, 10),
    tiktok: tiktokFiltered.slice(0, 10),
    combined: combined.slice(0, 15),
  };
}

// ============================================================================
// FALLBACK: Generate ideas from templates (only when Gemini fails)
// ============================================================================
function generateIdeasFromTemplates(keyword, platforms, trendSuggestions) {
  const vertical = detectVertical(keyword);
  const ideas = [];
  const competitors = COMPETITOR_NAMES_SHORT.slice(0, 3);
  const seenTitles = new Set();

  // Use keyword + only closely related trends
  const kwPool = [keyword, ...trendSuggestions.combined.filter(t => t.length > 3 && t !== keyword)];
  const maxTrends = Math.min(kwPool.length, 6);

  for (const platform of platforms) {
    const templates = IDEA_TEMPLATES[platform.toLowerCase()] || [];

    for (let k = 0; k < maxTrends; k++) {
      const kwToUse = kwPool[k];
      const startIdx = (k * 2) % templates.length;
      const selectedTemplates = [];
      for (let j = 0; j < 2 && j < templates.length; j++) {
        selectedTemplates.push(templates[(startIdx + j) % templates.length]);
      }

      for (const tpl of selectedTemplates) {
        const titulo = tpl.tituloTpl.replace(/\{kw\}/g, kwToUse);
        if (seenTitles.has(titulo)) continue;
        seenTitles.add(titulo);

        ideas.push({
          plataforma: platform.charAt(0).toUpperCase() + platform.slice(1),
          titulo,
          titulo_contenido: titulo,
          keyword_principal: kwToUse,
          tipo_contenido: tpl.tipo,
          vertical,
          prioridad: tpl.prioridad,
          competitors,
        });
      }
    }
  }

  return ideas;
}

// ============================================================================
// FUNCIÓN PRINCIPAL: Generar contenido custom
// ============================================================================
async function generateCustomContent(keyword, platforms = ["tiktok", "instagram", "facebook"], onProgress = null) {
  console.log(`\n🎯 Generando contenido para: "${keyword}"`);
  console.log(`📱 Plataformas: ${platforms.join(", ")}`);

  function progress(percent, message, detail = '') {
    if (onProgress) onProgress({ percent, message, detail });
  }

  progress(0, 'Iniciando generación...', `Keyword: "${keyword}"`);

  // 1. Test AI availability (Gemini, OpenAI, Anthropic)
  const available = getAvailableProviders();
  let useAI = available.length > 0;
  let geminiError = null;

  if (useAI) {
    console.log(`\n🤖 IA disponible: ${available.join(", ")} (${available.length} proveedor${available.length > 1 ? 'es' : ''})`);
    console.log(`   ✅ Generando contenido único con IA`);
  } else {
    console.log(`\n📋 Sin proveedores de IA configurados — usando templates`);
    geminiError = { error: "NO_KEY", message: "No hay proveedores de IA configurados. Agrega una API Key de Gemini, ChatGPT o Claude." };
  }

  // 2. Buscar tendencias reales para este keyword
  progress(5, 'Buscando tendencias en tiempo real...', 'Google + YouTube + TikTok');
  console.log(`\n🔍 Buscando tendencias en tiempo real...`);
  const trends = await fetchKeywordTrends(keyword);
  console.log(`  ✅ Google: ${trends.google.length} sugerencias relevantes`);
  console.log(`  ✅ YouTube: ${trends.youtube.length} sugerencias relevantes`);
  console.log(`  ✅ TikTok: ${trends.tiktok.length} sugerencias relevantes`);
  console.log(`  📊 Combinadas: ${trends.combined.length} únicas`);

  if (trends.combined.length > 0) {
    console.log(`  🔝 Top tendencias:`);
    trends.combined.slice(0, 5).forEach((t, i) => console.log(`     ${i + 1}. "${t}"`));
  }

  // 3. Generar ideas (con Gemini AI o templates como fallback)
  let ideas = [];
  let ideasSource = "templates";

  if (useAI) {
    progress(15, 'Generando ideas únicas con IA...', available.join(", "));
    console.log(`\n🤖 Generando ideas únicas con IA (${available.join(", ")})...`);
    try {
      const aiIdeas = await generateContentIdeasAI(keyword, trends.combined, platforms);
      if (aiIdeas && aiIdeas.length >= 3) {
        ideas = aiIdeas.map(idea => ({
          ...idea,
          vertical: idea.vertical || detectVertical(keyword),
          competitors: COMPETITOR_NAMES_SHORT.slice(0, 3),
        }));
        ideasSource = "gemini";
        console.log(`  ✅ ${ideas.length} ideas únicas generadas con IA`);
      } else {
        console.log(`  ⚠️ Gemini no generó suficientes ideas, usando templates`);
        ideas = generateIdeasFromTemplates(keyword, platforms, trends);
      }
    } catch (e) {
      console.log(`  ❌ Error generando ideas con Gemini: ${e.message}`);
      ideas = generateIdeasFromTemplates(keyword, platforms, trends);
    }
  } else {
    ideas = generateIdeasFromTemplates(keyword, platforms, trends);
  }

  console.log(`\n📝 Ideas generadas: ${ideas.length} (fuente: ${ideasSource})`);

  // 4. Generar content packs (archivos .docx)
  const baseOutputDir = path.join(__dirname, "..", "output");
  const outputDir = path.join(baseOutputDir, "custom_packs");

  // Limpiar packs anteriores (Windows-safe: rename + recreate + async delete)
  if (fs.existsSync(outputDir)) {
    const tempName = `custom_packs_old_${Date.now()}`;
    const tempDir = path.join(baseOutputDir, tempName);
    try {
      fs.renameSync(outputDir, tempDir);
      // Delete old dir in background using shell (Windows rmdir handles locks better)
      const { exec } = require("child_process");
      exec(`rmdir /s /q "${tempDir.replace(/\//g, "\\")}"`, () => {});
    } catch (e) {
      console.log(`   ⚠️ Cleanup rename failed: ${e.message}, trying direct delete`);
      try {
        const { execSync } = require("child_process");
        execSync(`rmdir /s /q "${outputDir.replace(/\//g, "\\")}"`, { stdio: "pipe", timeout: 10000 });
      } catch {}
    }
  }
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n━━━ Generando guiones + hashtags + prompts miniatura ━━━`);
  if (useAI) console.log(`🤖 Modo: IA Generativa (${available.join(", ")}) — cada guión es único\n`);
  else console.log(`📋 Modo: Templates — contenido basado en plantillas\n`);

  let geminiSuccessCount = 0;
  let geminiFailCount = 0;

  // Helper: process one platform (only 1 AI call per platform — hashtags use fast templates)
  async function processPlatform(idea, plat, folderPath, slug) {
    let script = null;
    let aiSuccess = false;
    let aiFail = false;

    if (useAI) {
      try {
        if (plat === "tiktok") script = await generateTikTokScriptAI(idea);
        else if (plat === "instagram") script = await generateInstagramScriptAI(idea);
        else script = await generateFacebookScriptAI(idea);

        if (script) aiSuccess = true;
        else aiFail = true;
      } catch {
        script = null;
        aiFail = true;
      }
    }

    // Fallback to templates
    if (!script) {
      if (plat === "tiktok") script = generateTikTokScript(idea);
      else if (plat === "instagram") script = generateInstagramScript(idea);
      else script = generateFacebookScript(idea);
    }
    // Hashtags always from templates (fast, no API call needed)
    const hashtags = generateHashtags(idea, plat);

    const doc = createWordDocument(idea, script, hashtags, null, plat, idea.competitors || []);
    const platLabel = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" }[plat];
    const docPath = path.join(folderPath, `Guion_${platLabel}_${slug.slice(0, 40)}.docx`);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docPath, buffer);

    return { aiSuccess, aiFail };
  }

  // Process ideas in PARALLEL BATCHES (8 ideas at once, 3 platforms each in parallel)
  const BATCH_SIZE = 8;
  const totalBatches = Math.ceil(ideas.length / BATCH_SIZE);
  progress(30, 'Generando guiones con IA...', `${ideas.length} ideas en ${totalBatches} batches paralelos`);

  for (let batch = 0; batch < ideas.length; batch += BATCH_SIZE) {
    const batchIdeas = ideas.slice(batch, batch + BATCH_SIZE);
    const batchNum = Math.floor(batch / BATCH_SIZE) + 1;
    const batchPercent = 30 + Math.round((batchNum / totalBatches) * 60);
    progress(batchPercent, `Generando guiones — batch ${batchNum}/${totalBatches}`, `${batchIdeas.length} ideas en paralelo`);
    console.log(`\n   🚀 Batch ${batchNum}/${totalBatches} (${batchIdeas.length} ideas en paralelo)...`);

    const batchResults = await Promise.all(
      batchIdeas.map(async (idea, batchIdx) => {
        const i = batch + batchIdx;
        const slug = idea.titulo.slice(0, 120).replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").trim().replace(/ +/g, "_");
        const folderName = `${String(i + 1).padStart(2, "0")}_${slug}`;
        const folderPath = path.join(outputDir, folderName);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

        // 3 platforms in PARALLEL per idea
        const platResults = await Promise.allSettled(
          ["tiktok", "instagram", "facebook"].map(plat =>
            processPlatform(idea, plat, folderPath, slug)
          )
        );

        let success = 0, fail = 0;
        for (const r of platResults) {
          if (r.status === "fulfilled") {
            if (r.value.aiSuccess) success++;
            if (r.value.aiFail) fail++;
          } else {
            console.log(`   ⚠️ Error en idea ${i + 1}: ${r.reason?.message || "unknown"}`);
          }
        }

        console.log(`   ✅ [${String(i + 1).padStart(2, "0")}/${ideas.length}] ${idea.titulo.slice(0, 55)}...`);
        return { success, fail };
      })
    );

    for (const r of batchResults) {
      geminiSuccessCount += r.success;
      geminiFailCount += r.fail;
    }
  }
  progress(95, 'Guardando resultados...', '');

  if (useAI) {
    console.log(`\n🤖 IA: ${geminiSuccessCount} guiones generados con IA, ${geminiFailCount} fallbacks a template`);
  }

  // 5. Guardar resumen JSON
  const summary = {
    keyword,
    platforms,
    vertical: detectVertical(keyword),
    generated_at: new Date().toISOString(),
    ai_powered: useAI,
    ideas_source: ideasSource,
    gemini_stats: useAI ? { success: geminiSuccessCount, fallback: geminiFailCount } : null,
    gemini_error: geminiError,
    trends: {
      google: trends.google,
      youtube: trends.youtube,
      tiktok: trends.tiktok,
      combined: trends.combined,
    },
    ideas: ideas.map(i => ({
      titulo: i.titulo,
      plataforma: i.plataforma,
      tipo: i.tipo_contenido || i.tipo,
      keyword: i.keyword_principal || i.keyword,
      vertical: i.vertical,
    })),
    total_packs: ideas.length,
  };

  fs.writeFileSync(
    path.join(outputDir, "custom_summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  console.log(`\n✅ ${ideas.length} content packs generados en: ${outputDir}`);
  return summary;
}

module.exports = { generateCustomContent, generateIdeasFromTemplates, detectVertical, fetchKeywordTrends };
