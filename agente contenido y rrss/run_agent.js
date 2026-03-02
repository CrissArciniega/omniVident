/**
 * ═══════════════════════════════════════════════════════════════════
 *  MEGA MAYORISTA — Agente de SEO y RRSS
 *  Script único de compilación
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Al ejecutar devuelve:
 *
 *  output/
 *  ├── MegaMayorista_SEO_RRSS.xlsx       ← Excel completo
 *  │     ├── Contexto Empresa
 *  │     ├── Competidores
 *  │     ├── Estrategia Buscadores
 *  │     ├── Tendencias Actuales          ← EN TIEMPO REAL
 *  │     ├── Tecnología (keywords ATP)
 *  │     ├── Belleza (keywords ATP)
 *  │     ├── Hogar (keywords ATP)
 *  │     ├── Variedades (keywords ATP)
 *  │     ├── Marca y Competencia
 *  │     ├── Ideas de Contenido
 *  │     └── Resumen Consolidado
 *  │
 *  └── content_packs/
 *        └── [N carpetas — basadas en tendencias EN TIEMPO REAL]/
 *              ├── Guion_TikTok_*.docx
 *              ├── Guion_Instagram_*.docx
 *              └── Guion_Facebook_*.docx
 *
 *  Uso:  node run_agent.js
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const {
  fetchCurrentTrends,
  COMPETITORS,
  COMPETITOR_NAMES_SHORT,
} = require("./scripts/trend_fetcher");
const {
  createWordDocument,
  generateTikTokScript,
  generateInstagramScript,
  generateFacebookScript,
  generateHashtags,
  generateThumbnailPrompt,
  Packer,
} = require("./scripts/word_generator");
const {
  generateTikTokScriptAI,
  generateInstagramScriptAI,
  generateFacebookScriptAI,
  generateContentIdeasAI,
  getAvailableProviders,
} = require("./scripts/ai_client");

const OUTPUT_DIR = path.join(__dirname, "output");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "agent_progress.json");

function writeProgress(percent, message, detail = '') {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ percent, message, detail, active: true, timestamp: Date.now() }));
  } catch {}
}

// ============================================================================
// 1. DATOS ESTÁTICOS — VERTICALS, KEYWORDS ATP, IDEAS
// ============================================================================

const VERTICALS = {
  tecnologia: {
    name: "Tecnología",
    seeds: [
      "gadgets tecnológicos", "accesorios para celular",
      "audífonos inalámbricos", "cargadores portátiles", "luces LED",
      "smartwatch barato", "accesorios gaming", "parlantes bluetooth",
      "cables y adaptadores", "protectores de pantalla",
    ],
  },
  belleza: {
    name: "Belleza",
    seeds: [
      "productos de belleza", "maquillaje importado",
      "skincare coreano", "brochas de maquillaje", "pestañas postizas",
      "cremas faciales", "esponjas de maquillaje", "sérum facial",
      "organizador de maquillaje", "kit de uñas",
    ],
  },
  hogar: {
    name: "Hogar",
    seeds: [
      "artículos para el hogar", "utensilios de cocina",
      "organizadores", "decoración del hogar", "productos de limpieza",
      "gadgets para cocina", "almacenamiento", "iluminación del hogar",
      "tapetes y alfombras", "accesorios de baño",
    ],
  },
  variedades: {
    name: "Variedades",
    seeds: [
      "juguetes novedosos", "regalos originales",
      "productos virales TikTok", "artículos de fiesta",
      "productos importados de China", "juguetes didácticos",
      "productos trending", "accesorios de moda",
      "artículos escolares", "productos novelty",
    ],
  },
};

const SEARCH_ENGINES = [
  { id: "google", name: "Google" },
  { id: "youtube", name: "YouTube" },
  { id: "tiktok", name: "TikTok" },
  { id: "amazon", name: "Amazon" },
  { id: "instagram", name: "Instagram" },
];

// --- Templates AnswerThePublic ---
const QUESTION_WORDS = {
  que: ["qué es {s}","qué {s} comprar","qué {s} son buenos y baratos","qué {s} están de moda","qué {s} vende Mega Mayorista","qué tipo de {s} hay","qué {s} regalar","qué marca de {s} es mejor"],
  como: ["cómo comprar {s} al por mayor","cómo elegir {s}","cómo usar {s}","cómo importar {s} de China","cómo encontrar {s} baratos","cómo vender {s} por internet","cómo saber si {s} son originales","cómo comparar {s} de calidad"],
  donde: ["dónde comprar {s} al por mayor","dónde venden {s} baratos","dónde comprar {s} en línea","dónde encontrar {s} importados","dónde conseguir {s} al mejor precio","dónde comprar {s} originales","dónde hay {s} cerca de mí"],
  cuando: ["cuándo comprar {s} más baratos","cuándo hay ofertas de {s}","cuándo llegan {s} nuevos","cuándo es temporada de {s}","cuándo conviene comprar {s} al por mayor"],
  por_que: ["por qué comprar {s} al por mayor","por qué {s} importados son más baratos","por qué {s} de China son populares","por qué elegir Mega Mayorista para {s}","por qué {s} están de moda en TikTok"],
  cual: ["cuál es el mejor {s}","cuál {s} conviene más","cuál es la diferencia entre {s}","cuáles son los {s} más vendidos","cuáles {s} recomienda Mega Mayorista","cuál {s} tiene mejor relación calidad-precio"],
  quien: ["quién vende {s} al por mayor","quién es Mega Mayorista","quién distribuye {s} en LATAM","quién tiene los mejores precios en {s}"],
};

const PREPOSITIONS = {
  para: ["{s} para revender","{s} para negocio","{s} para tienda","{s} para regalo","{s} para emprendedores","{s} para vender en redes sociales","{s} para el día de la madre","{s} para niños","{s} para mujeres","{s} para hombres"],
  con: ["{s} con envío gratis","{s} con garantía","{s} con descuento por mayoreo","{s} con precio de fábrica","{s} con buenas reseñas","{s} con mejor calidad"],
  sin: ["{s} sin intermediarios","{s} sin mínimo de compra","{s} sin marca genéricos","{s} sin costos ocultos"],
  cerca_de: ["{s} cerca de mí","{s} distribuidor cerca","mayorista de {s} cerca de mi ciudad","tienda de {s} cerca"],
  como: ["{s} como los de TikTok","{s} como los de AliExpress pero más rápido","{s} como los que vende G&G","{s} como negocio rentable"],
  desde: ["{s} desde China","{s} desde fábrica","{s} desde $1","{s} desde mayorista"],
  por: ["{s} por mayor","{s} por docena","{s} por catálogo","{s} por lote","{s} por internet"],
};

const COMPARISONS = {
  vs: ["Mega Mayorista vs G&G {s}","Mega Mayorista vs GYG VIP {s}","Mega Mayorista vs ColombiaXMayor {s}","{s} importados vs nacionales","{s} al por mayor vs al detal","AliExpress vs Mega Mayorista para {s}","{s} baratos vs {s} de marca"],
  o: ["{s} por mayor o por menor","{s} genéricos o de marca","{s} importados o nacionales","Mega Mayorista o G&G para {s}","comprar {s} online o en tienda física"],
  mejor_que: ["{s} Mega Mayorista mejor que G&G","{s} Mega Mayorista mejor que GYG VIP","{s} importados mejor que nacionales","precios {s} Mega Mayorista mejor que competencia"],
  diferencia: ["diferencia entre {s} original y réplica","diferencia entre {s} al por mayor y al detal","diferencia entre Mega Mayorista y G&G en {s}","diferencia entre Mega Mayorista y GYG VIP en {s}"],
};

const RELATED = {
  comerciales: [`{s} precio mayorista`,`{s} catálogo ${new Date().getFullYear()}`,`{s} proveedor confiable`,`{s} lote completo`,`{s} distribuidor autorizado`,`{s} stock disponible`,`{s} precio por unidad`,`{s} margen de ganancia`,`catálogo Mega Mayorista {s}`,`ofertas {s} al por mayor`],
  tendencias: [`{s} más vendidos ${new Date().getFullYear()}`,`{s} virales en TikTok`,`{s} trending`,`{s} novedades`,`{s} nuevos lanzamientos`,`{s} populares en redes`,`{s} que se venden solos`,`{s} para emprendimiento`,`{s} negocio rentable`,`{s} alta rotación`],
  competencia: ["G&G {s} precios","GYG VIP {s} precios","ColombiaXMayor {s}","Mayoreo.VIP {s}","alternativas a G&G para {s}","mayoristas de {s} en Latinoamérica","mejores proveedores de {s}","distribuidores {s} confiables"],
};

const ALPHABETICAL_MODIFIERS = {
  a:["al por mayor","accesorios","amazon","aliexpress","alta calidad","al mejor precio"],b:["baratos","buena calidad","bonitos","buenos","belleza","bluetooth"],c:["catálogo","china","calidad","comprar","con envío","cerca de mí"],d:["descuento","distribuidor","de marca","de moda","directo de fábrica","docena"],e:["económicos","en línea","en oferta","envío gratis","emprendimiento","elegantes"],f:["fábrica","fiesta","funcionan bien","femeninos","fotografía"],g:["gadgets","gratis","garantía","gaming","genéricos","G&G"],h:["hogar","hombres","herramientas","Halloween"],i:["importados","innovadores","internet","iluminación","infantiles"],j:["juguetes","jóvenes","japoneses"],k:["kit completo","kawaii","k-beauty"],l:["led","lote","luces","limpieza","Latinoamérica"],m:["mayoreo","Mega Mayorista","moda","maquillaje","mujer","mejor precio"],n:["novedosos","nuevos","navidad","niños","negocio"],o:["ofertas","originales","online","organizadores"],p:["precio","proveedores","por mayor","populares","premium"],q:["que se venden rápido","que están de moda","que funcionan"],r:["regalos","revender","recomendados","réplicas","rentable"],s:["skincare","smartwatch","surtido","stock","sin marca"],t:["tecnología","TikTok","trending","tienda","tiktok virales"],u:["útiles","unisex","utensilios","USB"],v:["virales","variedades","vender","variedad"],w:["wireless","wearables"],x:["xiaomi"],y:["y baratos","y bonitos","y útiles"],z:["zona mayorista"],
};

// --- Plantillas de ideas DINÁMICAS por plataforma ---
// Cada {kw} se reemplaza con keywords de tendencias en tiempo real
const IDEA_TEMPLATES_ALL = {
  "Blog SEO": [
    { tipo: "Guía",        tituloTpl: `Guía completa: Cómo comprar {kw} al por mayor en ${new Date().getFullYear()}`,      prioridad: "Alta" },
    { tipo: "Listicle",    tituloTpl: "Los 10 {kw} más vendidos que puedes revender",                prioridad: "Alta" },
    { tipo: "Comparativa", tituloTpl: "Mega Mayorista vs la competencia: {kw} precios y calidad",    prioridad: "Muy Alta" },
    { tipo: "Tutorial",    tituloTpl: "Cómo iniciar un negocio rentable con {kw} importados",        prioridad: "Alta" },
    { tipo: "FAQ",         tituloTpl: "Preguntas frecuentes sobre {kw} al por mayor",                prioridad: "Media" },
  ],
  "TikTok": [
    { tipo: "Hook viral",    tituloTpl: "POV: Descubriste que {kw} existe y ahora no puedes vivir sin esto",  prioridad: "Muy Alta" },
    { tipo: "Antes/Después", tituloTpl: "El antes y después usando {kw} — no vas a creer la diferencia",      prioridad: "Alta" },
    { tipo: "Showcase",      tituloTpl: "Los 5 {kw} más vendidos esta semana en Mega Mayorista",              prioridad: "Alta" },
    { tipo: "Storytelling",  tituloTpl: "Así empecé a vender {kw} y hoy facturo más de $3,000/mes",           prioridad: "Muy Alta" },
    { tipo: "Challenge",     tituloTpl: "RETO: Vendí {kw} por una semana y esto pasó",                        prioridad: "Alta" },
    { tipo: "Comparativa",   tituloTpl: "{kw} de $5 vs {kw} de $50 — ¿Cuál es mejor?",                       prioridad: "Alta" },
  ],
  "YouTube": [
    { tipo: "Unboxing",     tituloTpl: "UNBOXING: Los {kw} más pedidos de Mega Mayorista",           prioridad: "Alta" },
    { tipo: "Review",       tituloTpl: "Review honesto: ¿Valen la pena los {kw} importados?",        prioridad: "Alta" },
    { tipo: "Top / Ranking",tituloTpl: "TOP 10 {kw} para revender con alta ganancia",                prioridad: "Muy Alta" },
    { tipo: "Comparativa",  tituloTpl: "Mega Mayorista vs la competencia: ¿Quién tiene mejor {kw}?", prioridad: "Muy Alta" },
    { tipo: "Tutorial",     tituloTpl: "Cómo revender {kw} y ganar $1,000/mes desde casa",           prioridad: "Alta" },
  ],
  "Instagram": [
    { tipo: "Carousel educativo", tituloTpl: "5 cosas que debes saber antes de comprar {kw} al por mayor",       prioridad: "Alta" },
    { tipo: "Reel",               tituloTpl: "Unboxing: Los {kw} más pedidos esta semana",                       prioridad: "Alta" },
    { tipo: "Carousel producto",  tituloTpl: "Catálogo {kw}: precios y opciones para emprendedores",             prioridad: "Media" },
    { tipo: "Reel comparativa",   tituloTpl: "Mega Mayorista vs la competencia en {kw}",                         prioridad: "Muy Alta" },
    { tipo: "Carousel tips",      tituloTpl: "3 errores al comprar {kw} al por mayor y cómo evitarlos",          prioridad: "Alta" },
  ],
  "Facebook": [
    { tipo: "Post engagement", tituloTpl: "¿Ya probaste los nuevos {kw}? El que no lo tiene, se lo pierde",    prioridad: "Alta" },
    { tipo: "Storytelling",    tituloTpl: "TESTIMONIO: Cómo {kw} le cambió el negocio a nuestra clienta",      prioridad: "Muy Alta" },
    { tipo: "Promo",           tituloTpl: "OFERTA FLASH: {kw} con descuento especial al por mayor",            prioridad: "Alta" },
    { tipo: "Live",            tituloTpl: "EN VIVO: Mostrando los nuevos {kw} que acaban de llegar",            prioridad: "Muy Alta" },
    { tipo: "Caso de éxito",   tituloTpl: "De emprendedor a dueño de tienda gracias a {kw}",                   prioridad: "Alta" },
  ],
};

// Mapeo de keywords a verticales por detección automática
const VERTICAL_DETECT = {
  "Tecnología": ["gadget", "tech", "smartwatch", "celular", "audífono", "bluetooth", "led", "usb", "cargador", "power bank", "tablet", "gaming", "auricular", "parlante", "altavoz", "inalambric", "wireless", "electr"],
  "Belleza": ["skincare", "maquillaje", "belleza", "crema", "sérum", "pestañ", "brocha", "cosmetic", "labial", "coreano", "facial", "cabello", "shampoo", "uñas", "perfume"],
  "Hogar": ["cocina", "hogar", "organizador", "utensilio", "decoración", "limpieza", "jardín", "mueble", "baño", "almacenamiento", "casa"],
  "Variedades": ["juguete", "fiesta", "regalo", "novedos", "viral", "tiktok", "trending", "moda", "ropa", "accesorio"],
};

function detectVerticalFromKw(keyword) {
  const kw = keyword.toLowerCase();
  for (const [vertical, terms] of Object.entries(VERTICAL_DETECT)) {
    if (terms.some(t => kw.includes(t))) return vertical;
  }
  return "General";
}

/**
 * Genera ideas de contenido DINÁMICAS a partir de tendencias reales
 * Usa IA cuando está disponible para títulos únicos cada vez
 * Fallback: templates aleatorias (nunca las mismas 2)
 */
async function generateDynamicIdeas(trendData) {
  const availableProviders = getAvailableProviders();
  const useAI = availableProviders.length > 0;

  // Seleccionar keywords de tendencias reales (con metadata de fuente)
  // Max 6 keywords para ejecución rápida (~30 ideas, ~90 guiones)
  const MAX_KEYWORDS = 6;
  let selectedKeywords = [];   // strings
  let keywordMeta = {};        // keyword -> { sources, rank, seed, count }
  if (trendData && trendData.all_keywords_ranked && trendData.all_keywords_ranked.length > 0) {
    const ranked = trendData.all_keywords_ranked;
    // 1-2 keywords de cada vertical para diversidad
    for (const kw of ranked) {
      if (selectedKeywords.length >= MAX_KEYWORDS) break;
      const vertical = detectVerticalFromKw(kw.keyword);
      const vertCount = selectedKeywords.filter(sk => detectVerticalFromKw(sk) === vertical).length;
      if (vertCount < 2 && kw.keyword.length > 5) {
        selectedKeywords.push(kw.keyword);
        keywordMeta[kw.keyword] = { sources: kw.sources || [], rank: selectedKeywords.length, seed: kw.seed || '', count: kw.count || 1 };
      }
    }
    // Llenar restantes con top keywords
    for (const kw of ranked) {
      if (selectedKeywords.length >= MAX_KEYWORDS) break;
      if (!selectedKeywords.includes(kw.keyword) && kw.keyword.length > 5) {
        selectedKeywords.push(kw.keyword);
        keywordMeta[kw.keyword] = { sources: kw.sources || [], rank: selectedKeywords.length, seed: kw.seed || '', count: kw.count || 1 };
      }
    }
  } else {
    console.log("  ⚠️ Sin tendencias, usando keywords semilla como respaldo");
    for (const v of Object.values(VERTICALS)) {
      if (selectedKeywords.length >= MAX_KEYWORDS) break;
      selectedKeywords.push(v.seeds[0]);
    }
  }

  console.log(`  🎯 Keywords seleccionadas para ideas:`);
  selectedKeywords.forEach((kw, i) => console.log(`     ${i + 1}. "${kw}" (${detectVerticalFromKw(kw)})`));

  // Si hay IA disponible, generar ideas únicas con IA para cada batch de keywords
  if (useAI) {
    console.log(`\n  🤖 Generando ideas únicas con IA (${availableProviders.join(", ")})...`);
    writeProgress(25, 'Generando ideas únicas con IA...', `${selectedKeywords.length} keywords de tendencia`);
    const allIdeas = [];
    const competitors = COMPETITOR_NAMES_SHORT.slice(0, 3);

    // Procesar TODOS los keywords en paralelo (son max 6, rápido)
    const batchResults = await Promise.allSettled(
      selectedKeywords.map(kw =>
        generateContentIdeasAI(kw, trendData?.all_keywords_ranked?.slice(0, 8).map(t => t.keyword) || [], ["tiktok", "instagram", "facebook"], 2)
      )
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      const kw = selectedKeywords[j];
      const meta = keywordMeta[kw] || {};
      if (r.status === "fulfilled" && r.value && r.value.length >= 2) {
        const ideas = r.value.slice(0, 6).map(idea => ({
          ...idea,
          titulo_contenido: idea.titulo || idea.titulo_contenido,
          keyword_principal: kw,
          keyword: kw,
          vertical: idea.vertical || detectVerticalFromKw(kw),
          competitors,
          trendSources: meta.sources || [],
          trendRank: meta.rank || null,
        }));
        allIdeas.push(...ideas);
        console.log(`     ✅ "${kw}" → ${ideas.length} ideas únicas`);
      } else {
        // Fallback a templates para este keyword
        console.log(`     ⚠️ "${kw}" → IA falló, usando templates`);
        const fallback = generateIdeasFromKeywords([kw]);
        fallback.forEach(f => { f.trendSources = meta.sources || []; f.trendRank = meta.rank || null; });
        allIdeas.push(...fallback);
      }
    }
    return allIdeas;
  }

  // Fallback sin IA: templates aleatorias (propagar metadata de tendencia)
  const fallbackIdeas = generateIdeasFromKeywords(selectedKeywords);
  fallbackIdeas.forEach(idea => {
    const meta = keywordMeta[idea.keyword] || {};
    idea.trendSources = meta.sources || [];
    idea.trendRank = meta.rank || null;
  });
  return fallbackIdeas;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateIdeasFromKeywords(keywords) {
  const ideas = [];
  const competitors = COMPETITOR_NAMES_SHORT.slice(0, 3);
  // Solo plataformas sociales (TikTok, Instagram, Facebook) para guiones
  const socialPlatforms = ["TikTok", "Instagram", "Facebook"];

  for (const keyword of keywords) {
    const vertical = detectVerticalFromKw(keyword);

    for (const plataforma of socialPlatforms) {
      const templates = IDEA_TEMPLATES_ALL[plataforma] || [];
      // 1 template aleatoria por plataforma
      const selectedTemplates = shuffle(templates).slice(0, 1);
      for (const tpl of selectedTemplates) {
        const titulo = tpl.tituloTpl.replace(/\{kw\}/g, keyword);
        ideas.push({
          plataforma,
          titulo,
          titulo_contenido: titulo,
          keyword_principal: keyword,
          keyword: keyword,
          tipo_contenido: tpl.tipo,
          tipo: tpl.tipo,
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
// 2. FUNCIONES GENERADORAS DE KEYWORDS ATP
// ============================================================================

function expand(tpl, seed) { return tpl.replace(/\{s\}/g, seed); }

function genQuestions(seed) {
  const rows = [];
  for (const [tipo, tpls] of Object.entries(QUESTION_WORDS))
    for (const t of tpls)
      rows.push({ keyword_seed: seed, categoria_atp: "Preguntas", subtipo: tipo.replace("_"," "), keyword_generada: expand(t, seed), intent: "Informacional" });
  return rows;
}
function genPrepositions(seed) {
  const rows = [];
  for (const [prep, tpls] of Object.entries(PREPOSITIONS))
    for (const t of tpls)
      rows.push({ keyword_seed: seed, categoria_atp: "Preposiciones", subtipo: prep.replace("_"," "), keyword_generada: expand(t, seed), intent: "Transaccional" });
  return rows;
}
function genComparisons(seed) {
  const rows = [];
  for (const [tipo, tpls] of Object.entries(COMPARISONS))
    for (const t of tpls)
      rows.push({ keyword_seed: seed, categoria_atp: "Comparaciones", subtipo: tipo.replace("_"," "), keyword_generada: expand(t, seed), intent: "Comercial" });
  return rows;
}
function genRelated(seed) {
  const rows = [];
  for (const [tipo, tpls] of Object.entries(RELATED))
    for (const t of tpls)
      rows.push({ keyword_seed: seed, categoria_atp: "Relacionadas", subtipo: tipo, keyword_generada: expand(t, seed), intent: tipo === "comerciales" ? "Transaccional" : tipo === "tendencias" ? "Informacional" : "Competitiva" });
  return rows;
}
function genAlphabetical(seed) {
  const rows = [];
  for (const [letter, mods] of Object.entries(ALPHABETICAL_MODIFIERS))
    for (const m of mods)
      rows.push({ keyword_seed: seed, categoria_atp: "Alfabéticas", subtipo: letter.toUpperCase(), keyword_generada: `${seed} ${m}`, intent: "Long-tail" });
  return rows;
}

// ============================================================================
// 3. GENERACIÓN DEL EXCEL
// ============================================================================

function buildExcel(trendData, dynamicIdeas) {
  const wb = XLSX.utils.book_new();
  const ts = new Date().toLocaleString("es-MX");

  // --- Hoja 1: Contexto Empresa ---
  const ctx = [
    { campo: "Empresa", valor: "Mega Mayorista", notas: "Marca principal SEO y RRSS" },
    { campo: "Slogan", valor: "Impulsando tu éxito cada día", notas: "Presente en logo y brand bar" },
    { campo: "Giro", valor: "Distribución mayorista y minorista de productos importados", notas: "B2B y B2C" },
    { campo: "Verticales", valor: "Tecnología, Belleza, Hogar, Variedades", notas: "4 verticales" },
    { campo: "Origen", valor: "Importados de China", notas: "Diferenciador de precio" },
    { campo: "Mercado", valor: "Latinoamérica (LATAM)", notas: "Español LATAM" },
    { campo: "Clientes", valor: "Emprendedores, revendedores, tiendas, consumidor final", notas: "Mayoreo y detal" },
    { campo: "Canales", valor: "TikTok, Instagram, Facebook, YouTube, Blog", notas: "5 plataformas" },
    { campo: "USP", valor: "Precios de fábrica, variedad, envío rápido, sin intermediarios", notas: "Propuesta de valor" },
    { campo: "Referencia SEO", valor: "AnswerThePublic (5 categorías)", notas: "Preguntas, Preposiciones, Comparaciones, Relacionadas, Alfabéticas" },
    { campo: "Compilado", valor: ts, notas: "Fecha de esta ejecución del agente" },
  ];
  const ws1 = XLSX.utils.json_to_sheet(ctx);
  ws1["!cols"] = [{ wch: 18 }, { wch: 60 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Contexto Empresa");

  // --- Hoja 2: Competidores ---
  const compRows = [];
  for (const [cat, comps] of Object.entries(COMPETITORS))
    for (const c of comps)
      compRows.push({ categoria: cat, nombre: c.nombre, pais: c.pais, fortaleza: c.fuerte, relevancia_vs_mega: `Comparar precios, catálogo y servicio vs ${c.nombre}` });
  const ws2 = XLSX.utils.json_to_sheet(compRows);
  ws2["!cols"] = [{ wch: 15 }, { wch: 28 }, { wch: 20 }, { wch: 40 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Competidores");

  // --- Hoja 3: Estrategia Buscadores ---
  const strat = [
    { buscador: "Google", trafico: "Orgánico SEO", intencion: "Informacional + Transaccional", formatos: "Blog, FAQs, guías, landing pages", estrategia_mega: "Dominar 'mayorista de [producto]' y 'comprar [producto] al por mayor'", vs_competencia: "Contenido más completo que G&G, GYG VIP y ColombiaXMayor" },
    { buscador: "YouTube", trafico: "Video orgánico", intencion: "Informacional + Descubrimiento", formatos: "Unboxing, reviews, comparativas, top 10", estrategia_mega: "Videos de catálogo con CTA a tienda", vs_competencia: "Más frecuencia y producción que G&G y GYG VIP" },
    { buscador: "TikTok", trafico: "Viral / For You", intencion: "Descubrimiento + Viral", formatos: "Videos 15-60s, hooks, trends, POV", estrategia_mega: "Hooks en 3s mostrando productos 'wow'", vs_competencia: "Engagement superior a GYG VIP (575K seguidores)" },
    { buscador: "Amazon", trafico: "E-commerce", intencion: "Transaccional directa", formatos: "Fichas de producto, títulos SEO", estrategia_mega: "Keywords de alta intención comercial", vs_competencia: "Mejor precio que AliExpress con envío rápido" },
    { buscador: "Instagram", trafico: "Social / Explore", intencion: "Visual + Engagement", formatos: "Carousels, Reels, Stories", estrategia_mega: "Carousels educativos + link en bio", vs_competencia: "Estética profesional vs G&G y DeNovedad" },
  ];
  const ws3 = XLSX.utils.json_to_sheet(strat);
  ws3["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 45 }, { wch: 55 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Estrategia Buscadores");

  // --- Hoja 4: TENDENCIAS ACTUALES (tiempo real) ---
  if (trendData && trendData.all_keywords_ranked) {
    const trendRows = trendData.all_keywords_ranked.map((t, i) => ({
      ranking: i + 1,
      keyword: t.keyword,
      fuentes: t.sources.join(" + "),
      verticales: t.verticals.join(", "),
      semilla_origen: t.seed,
      apariciones: t.count,
    }));
    const ws4 = XLSX.utils.json_to_sheet(trendRows);
    ws4["!cols"] = [{ wch: 8 }, { wch: 50 }, { wch: 18 }, { wch: 28 }, { wch: 35 }, { wch: 12 }];
    ws4["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: trendRows.length, c: 5 } }) };
    XLSX.utils.book_append_sheet(wb, ws4, "Tendencias Actuales");
  }

  // --- Hojas 5-8: Keywords por Vertical ---
  let totalKw = 0;
  for (const [, vertical] of Object.entries(VERTICALS)) {
    const allRows = [];
    for (const seed of vertical.seeds) {
      const qs = genQuestions(seed);
      const ps = genPrepositions(seed);
      const cs = genComparisons(seed);
      const rs = genRelated(seed);
      const as = genAlphabetical(seed);
      for (const eng of SEARCH_ENGINES) {
        const addEng = (rows) => rows.map(r => ({ ...r, buscador: eng.name }));
        allRows.push(...addEng(qs), ...addEng(ps), ...addEng(cs), ...addEng(rs), ...addEng(as));
      }
    }
    totalKw += allRows.length;
    const ws = XLSX.utils.json_to_sheet(allRows);
    ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 65 }, { wch: 18 }, { wch: 14 }];
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: allRows.length, c: 5 } }) };
    XLSX.utils.book_append_sheet(wb, ws, vertical.name);
  }

  // --- Hoja 9: Marca y Competencia ---
  const brandRows = [
    { tipo:"Marca Propia", keyword:"Mega Mayorista", intent:"Navegacional", prioridad:"Alta" },
    { tipo:"Marca Propia", keyword:"Mega Mayorista catálogo", intent:"Navegacional", prioridad:"Alta" },
    { tipo:"Marca Propia", keyword:"Mega Mayorista precios", intent:"Transaccional", prioridad:"Alta" },
    { tipo:"Marca Propia", keyword:"Mega Mayorista ofertas", intent:"Transaccional", prioridad:"Alta" },
    { tipo:"Marca Propia", keyword:"Mega Mayorista opiniones", intent:"Informacional", prioridad:"Media" },
    { tipo:"Marca Propia", keyword:"Mega Mayorista tienda en línea", intent:"Navegacional", prioridad:"Alta" },
    { tipo:"Marca Propia", keyword:"Mega Mayorista mayoreo", intent:"Transaccional", prioridad:"Alta" },
    { tipo:"Marca Propia", keyword:"Mega Mayorista WhatsApp", intent:"Navegacional", prioridad:"Media" },
    { tipo:"Competencia G&G", keyword:"G&G productos", intent:"Nav. competidor", prioridad:"Alta" },
    { tipo:"Competencia G&G", keyword:"G&G precios mayoreo", intent:"Trans. competidor", prioridad:"Alta" },
    { tipo:"Competencia G&G", keyword:"alternativas a G&G", intent:"Comercial", prioridad:"Muy Alta" },
    { tipo:"Competencia GYG VIP", keyword:"GYG VIP productos", intent:"Nav. competidor", prioridad:"Alta" },
    { tipo:"Competencia GYG VIP", keyword:"GYG VIP precios", intent:"Trans. competidor", prioridad:"Alta" },
    { tipo:"Competencia GYG VIP", keyword:"alternativas a GYG VIP", intent:"Comercial", prioridad:"Muy Alta" },
    { tipo:"Competencia ColombiaXMayor", keyword:"Colombia X Mayor catálogo", intent:"Nav. competidor", prioridad:"Alta" },
    { tipo:"Competencia Mayoreo.VIP", keyword:"Mayoreo VIP productos", intent:"Nav. competidor", prioridad:"Alta" },
    { tipo:"Competencia DeNovedad", keyword:"De Novedad cosméticos", intent:"Nav. competidor", prioridad:"Media" },
    { tipo:"Comparativa", keyword:"Mega Mayorista vs G&G vs GYG VIP", intent:"Comercial", prioridad:"Muy Alta" },
    { tipo:"Comparativa", keyword:"Mega Mayorista vs ColombiaXMayor precios", intent:"Comercial", prioridad:"Muy Alta" },
    { tipo:"Comparativa", keyword:"qué mayorista es mejor en LATAM", intent:"Comercial", prioridad:"Muy Alta" },
    { tipo:"Comparativa", keyword:"Mega Mayorista vs AliExpress envío", intent:"Comercial", prioridad:"Alta" },
    { tipo:"Comparativa", keyword:"mayoristas confiables Latinoamérica ranking", intent:"Comercial", prioridad:"Alta" },
  ];
  const ws9 = XLSX.utils.json_to_sheet(brandRows);
  ws9["!cols"] = [{ wch: 28 }, { wch: 50 }, { wch: 20 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws9, "Marca y Competencia");

  // --- Hoja 10: Ideas de Contenido (DINÁMICAS) ---
  const ideasRows = (dynamicIdeas || []).map(i => ({
    plataforma: i.plataforma,
    titulo: i.titulo || i.titulo_contenido,
    keyword_principal: i.keyword || i.keyword_principal,
    tipo_contenido: i.tipo || i.tipo_contenido,
    vertical: i.vertical,
    prioridad: i.prioridad,
    competidores: (i.competitors || []).join(", "),
  }));
  const ws10 = XLSX.utils.json_to_sheet(ideasRows);
  ws10["!cols"] = [{ wch: 12 }, { wch: 62 }, { wch: 38 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws10, "Ideas de Contenido");

  // --- Hoja 11: Resumen ---
  const summRows = [];
  for (const [, v] of Object.entries(VERTICALS))
    for (const seed of v.seeds) {
      const q = genQuestions(seed).length, p = genPrepositions(seed).length;
      const c = genComparisons(seed).length, r = genRelated(seed).length;
      const a = genAlphabetical(seed).length;
      summRows.push({ vertical: v.name, seed, preguntas: q, preposiciones: p, comparaciones: c, relacionadas: r, alfabeticas: a, subtotal: q+p+c+r+a, total_x_buscadores: (q+p+c+r+a)*SEARCH_ENGINES.length });
    }
  const ws11 = XLSX.utils.json_to_sheet(summRows);
  ws11["!cols"] = [{ wch: 13 }, { wch: 32 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 11 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws11, "Resumen");

  return { wb, totalKw };
}

// ============================================================================
// 4. GENERACIÓN DE CONTENT PACKS (Word con guión + hashtags + prompt miniatura)
// ============================================================================

function slugify(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")
    .toLowerCase().slice(0, 120);
}

const SOCIAL_PLATFORMS = ["tiktok", "instagram", "facebook"];

async function buildContentPacks(dynamicIdeas) {
  const baseDir = path.join(OUTPUT_DIR, "content_packs");
  // Limpiar packs anteriores para evitar contenido duplicado/viejo
  if (fs.existsSync(baseDir)) {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
  fs.mkdirSync(baseDir, { recursive: true });

  const ideas = dynamicIdeas || [];
  let totalDocs = 0;
  const errors = [];
  const totalIdeas = ideas.length;

  // Check AI availability (Gemini, OpenAI/ChatGPT, Claude)
  const availableProviders = getAvailableProviders();
  const useAI = availableProviders.length > 0;

  if (useAI) {
    console.log(`   🤖 IA disponible: ${availableProviders.join(", ")} (${availableProviders.length} proveedor${availableProviders.length > 1 ? 'es' : ''})`);
    console.log(`   ✅ Generando guiones únicos con IA`);
  } else {
    console.log(`   📋 Sin proveedores de IA configurados — usando templates`);
    console.log(`   💡 Configura una API Key (Gemini, ChatGPT o Claude) en el dashboard para guiones únicos`);
  }

  let aiSuccess = 0;
  let aiFail = 0;

  // Helper: process one platform for an idea
  async function processPlatform(ideaAdapted, platform, ideaDir, slug, competitors) {
    let script = null;
    let success = false;
    let fail = false;

    if (useAI) {
      try {
        if (platform === "tiktok") script = await generateTikTokScriptAI(ideaAdapted);
        else if (platform === "instagram") script = await generateInstagramScriptAI(ideaAdapted);
        else script = await generateFacebookScriptAI(ideaAdapted);
        if (script) success = true;
        else fail = true;
      } catch {
        script = null;
        fail = true;
      }
    }

    // Fallback to templates
    if (!script) {
      if (platform === "tiktok") script = generateTikTokScript(ideaAdapted);
      else if (platform === "instagram") script = generateInstagramScript(ideaAdapted);
      else script = generateFacebookScript(ideaAdapted);
    }
    const hashtags = generateHashtags(ideaAdapted, platform);

    const doc = createWordDocument(ideaAdapted, script, hashtags, null, platform, competitors);
    const platLabel = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" }[platform];
    const docPath = path.join(ideaDir, `Guion_${platLabel}_${slug.slice(0, 40)}.docx`);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docPath, buffer);

    return { success, fail };
  }

  // Build summary for full titles + trend source
  const packsSummary = [];

  // Process ideas in PARALLEL BATCHES (10 at once, 3 platforms each in parallel)
  const BATCH_SIZE = 10;
  const totalBatches = Math.ceil(ideas.length / BATCH_SIZE);

  for (let batch = 0; batch < ideas.length; batch += BATCH_SIZE) {
    const batchIdeas = ideas.slice(batch, batch + BATCH_SIZE);
    const batchNum = Math.floor(batch / BATCH_SIZE) + 1;
    const batchPercent = 50 + Math.round((batchNum / totalBatches) * 40);
    writeProgress(batchPercent, `Generando guiones — batch ${batchNum}/${totalBatches}`, `${batchIdeas.length} ideas en paralelo`);
    console.log(`\n   🚀 Batch ${batchNum}/${totalBatches} (${batchIdeas.length} ideas en paralelo)...`);

    const batchResults = await Promise.all(
      batchIdeas.map(async (idea, batchIdx) => {
        const i = batch + batchIdx;
        const fullTitle = idea.titulo || idea.titulo_contenido;
        const ideaAdapted = {
          titulo_contenido: fullTitle,
          keyword_principal: idea.keyword || idea.keyword_principal,
          tipo_contenido: idea.tipo || idea.tipo_contenido,
          vertical: idea.vertical,
          prioridad: idea.prioridad,
          plataforma: idea.plataforma,
        };

        const num = String(i + 1).padStart(2, "0");
        const slug = slugify(fullTitle);
        const folderName = `${num}_${slug}`;
        const ideaDir = path.join(baseDir, folderName);
        if (!fs.existsSync(ideaDir)) fs.mkdirSync(ideaDir, { recursive: true });

        // Save full title + metadata for this pack
        packsSummary.push({
          folder: folderName,
          fullTitle: fullTitle,
          keyword: idea.keyword || idea.keyword_principal,
          vertical: idea.vertical || '',
          tipo: idea.tipo || idea.tipo_contenido || '',
          plataforma: idea.plataforma || '',
          prioridad: idea.prioridad || '',
          trendSources: idea.trendSources || [],
          trendRank: idea.trendRank || null,
          generatedWithAI: useAI,
        });

        // 3 platforms in PARALLEL
        const platResults = await Promise.allSettled(
          SOCIAL_PLATFORMS.map(platform =>
            processPlatform(ideaAdapted, platform, ideaDir, slug, idea.competitors || [])
          )
        );

        let docs = 0, s = 0, f = 0;
        for (const r of platResults) {
          if (r.status === "fulfilled") {
            docs++;
            if (r.value.success) s++;
            if (r.value.fail) f++;
          } else {
            errors.push({ idea: fullTitle, platform: "unknown", error: r.reason?.message || "unknown" });
          }
        }

        process.stdout.write(`   ✅ [${num}/${totalIdeas}] ${fullTitle.slice(0, 60)}...\n`);
        return { docs, s, f };
      })
    );

    for (const r of batchResults) {
      totalDocs += r.docs;
      aiSuccess += r.s;
      aiFail += r.f;
    }
  }

  // Write packs summary JSON with full titles
  try {
    fs.writeFileSync(
      path.join(baseDir, 'packs_summary.json'),
      JSON.stringify({ packs: packsSummary, generatedAt: new Date().toISOString(), totalPacks: packsSummary.length }, null, 2),
      'utf8'
    );
    console.log(`\n   📋 packs_summary.json guardado (${packsSummary.length} packs con títulos completos)`);
  } catch (e) {
    console.log(`   ⚠️ Error al guardar packs_summary.json: ${e.message}`);
  }

  if (useAI) {
    console.log(`\n   🤖 IA: ${aiSuccess} guiones generados con IA, ${aiFail} fallbacks a template`);
  }

  return { totalDocs, errors, baseDir, totalIdeas };
}

// ============================================================================
// 5. MAIN — ORQUESTADOR ÚNICO
// ============================================================================

async function main() {
  const startTime = Date.now();

  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║        MEGA MAYORISTA — Agente SEO y RRSS                       ║");
  console.log("║        Compilación completa                                      ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");
  console.log("");

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeProgress(0, 'Iniciando agente SEO y RRSS...', '');

  // ━━━ PASO 1: Tendencias en tiempo real ━━━
  writeProgress(5, 'Buscando tendencias en tiempo real...', 'Google + YouTube Autocomplete');
  console.log("━━━ [1/3] Obteniendo tendencias en tiempo real ━━━\n");
  let trendData = null;
  try {
    trendData = await fetchCurrentTrends();
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "tendencias_actuales.json"),
      JSON.stringify(trendData, null, 2),
      "utf8"
    );
  } catch (err) {
    console.log(`  ⚠️ Tendencias no disponibles: ${err.message}`);
  }

  // ━━━ PASO 2: Generar ideas dinámicas (con IA si disponible) ━━━
  writeProgress(20, 'Generando ideas de contenido...', 'Usando IA + tendencias reales');
  console.log("\n━━━ [2/4] Generando ideas de contenido dinámicas ━━━\n");
  const dynamicIdeas = await generateDynamicIdeas(trendData);
  console.log(`\n  📝 Total ideas generadas: ${dynamicIdeas.length}`);
  console.log(`     (Basadas en tendencias reales — contenido diferente cada ejecución)\n`);

  // ━━━ PASO 3: Generar Excel ━━━
  writeProgress(35, 'Construyendo Excel SEO...', 'Keywords ATP + Competidores + Estrategia');
  console.log("━━━ [3/4] Generando Excel SEO completo ━━━\n");
  const { wb, totalKw } = buildExcel(trendData, dynamicIdeas);
  const excelPath = path.join(OUTPUT_DIR, "MegaMayorista_SEO_RRSS.xlsx");
  XLSX.writeFile(wb, excelPath);
  console.log(`  📊 Excel generado: ${excelPath}`);
  console.log(`     → ${totalKw.toLocaleString()} keywords ATP`);
  console.log(`     → ${trendData ? trendData.all_keywords_ranked.length : 0} tendencias en tiempo real`);
  console.log(`     → ${dynamicIdeas.length} ideas de contenido (dinámicas)`);
  console.log(`     → ${Object.values(COMPETITORS).flat().length} competidores mapeados`);

  // ━━━ PASO 4: Content Packs ━━━
  writeProgress(50, 'Generando guiones con IA...', 'TikTok + Instagram + Facebook');
  console.log("\n━━━ [4/4] Generando Content Packs (guiones + hashtags + prompts miniatura) ━━━\n");
  const { totalDocs, errors, baseDir, totalIdeas } = await buildContentPacks(dynamicIdeas);

  writeProgress(95, 'Finalizando...', 'Guardando resumen');

  // ━━━ RESUMEN FINAL ━━━
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "═".repeat(67));
  console.log("  ✅ COMPILACIÓN COMPLETADA");
  console.log("═".repeat(67));
  console.log("");
  console.log("  📦 ENTREGABLES:");
  console.log("");
  console.log(`  1. EXCEL SEO COMPLETO`);
  console.log(`     📄 ${excelPath}`);
  console.log(`     ├── Contexto Empresa`);
  console.log(`     ├── Competidores (${Object.values(COMPETITORS).flat().length} mayoristas)`);
  console.log(`     ├── Estrategia por Buscador (5)`);
  console.log(`     ├── Tendencias Actuales (${trendData ? trendData.all_keywords_ranked.length : 0} keywords en vivo)`);
  console.log(`     ├── Keywords Tecnología / Belleza / Hogar / Variedades`);
  console.log(`     ├── Marca y Competencia (22 keywords)`);
  console.log(`     ├── Ideas de Contenido (${dynamicIdeas.length} — DINÁMICAS)`);
  console.log(`     └── Resumen Consolidado`);
  console.log("");
  console.log(`  2. CONTENT PACKS`);
  console.log(`     📁 ${baseDir}`);
  console.log(`     └── ${totalIdeas} carpetas × 3 plataformas = ${totalDocs} documentos Word`);
  console.log(`         Cada .docx contiene: guión completo + hashtags + prompt de miniatura IA`);
  console.log(`         ⚡ Contenido generado desde tendencias EN TIEMPO REAL`);
  console.log("");
  console.log(`  ⏱  Tiempo total: ${elapsed}s`);
  console.log(`  ❌ Errores: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log(`     → [${e.platform}] ${e.idea}: ${e.error}`));
  }
  console.log("═".repeat(67));
}

main().then(() => {
  writeProgress(100, 'Completado', '');
}).catch(err => {
  writeProgress(0, '', '');
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
