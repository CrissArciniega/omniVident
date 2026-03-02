/**
 * Generador de Keywords estilo AnswerThePublic para Mega Mayorista
 *
 * Contexto empresarial:
 *   - Mega Mayorista: distribuidor mayorista y minorista
 *   - Verticales: tecnología, belleza, hogar, variedades
 *   - Competencia directa: G&G
 *   - Mercado: LATAM (español latinoamericano)
 *
 * Estructura AnswerThePublic:
 *   1. Preguntas (qué, cómo, dónde, cuándo, por qué, cuál, quién)
 *   2. Preposiciones (para, con, sin, cerca de, como)
 *   3. Comparaciones (vs, o, y, mejor que)
 *   4. Relacionadas (búsquedas asociadas)
 *   5. Alfabéticas (A-Z expansión)
 *
 * Buscadores cubiertos: Google, YouTube, TikTok, Amazon, Instagram
 */

const XLSX = require("xlsx");
const path = require("path");

// ============================================================================
// DEFINICIÓN DE SEMILLAS POR VERTICAL
// ============================================================================

const VERTICALS = {
  tecnologia: {
    name: "Tecnología",
    seeds: [
      "gadgets tecnológicos",
      "accesorios para celular",
      "audífonos inalámbricos",
      "cargadores portátiles",
      "luces LED",
      "smartwatch barato",
      "accesorios gaming",
      "parlantes bluetooth",
      "cables y adaptadores",
      "protectores de pantalla",
    ],
  },
  belleza: {
    name: "Belleza",
    seeds: [
      "productos de belleza",
      "maquillaje importado",
      "skincare coreano",
      "brochas de maquillaje",
      "pestañas postizas",
      "cremas faciales",
      "esponjas de maquillaje",
      "sérum facial",
      "organizador de maquillaje",
      "kit de uñas",
    ],
  },
  hogar: {
    name: "Hogar",
    seeds: [
      "artículos para el hogar",
      "utensilios de cocina",
      "organizadores",
      "decoración del hogar",
      "productos de limpieza",
      "gadgets para cocina",
      "almacenamiento",
      "iluminación del hogar",
      "tapetes y alfombras",
      "accesorios de baño",
    ],
  },
  variedades: {
    name: "Variedades",
    seeds: [
      "juguetes novedosos",
      "regalos originales",
      "productos virales TikTok",
      "artículos de fiesta",
      "productos importados de China",
      "juguetes didácticos",
      "productos trending",
      "accesorios de moda",
      "artículos escolares",
      "productos novelty",
    ],
  },
};

// ============================================================================
// BUSCADORES
// ============================================================================

const SEARCH_ENGINES = [
  { id: "google", name: "Google", icon: "🔍" },
  { id: "youtube", name: "YouTube", icon: "▶️" },
  { id: "tiktok", name: "TikTok", icon: "🎵" },
  { id: "amazon", name: "Amazon", icon: "📦" },
  { id: "instagram", name: "Instagram", icon: "📸" },
];

// ============================================================================
// CATEGORÍAS ANSWERTHEPUBLIC
// ============================================================================

// 1. PREGUNTAS
const QUESTION_WORDS = {
  que: [
    "qué es {seed}",
    "qué {seed} comprar",
    "qué {seed} son buenos y baratos",
    "qué {seed} están de moda",
    "qué {seed} vende Mega Mayorista",
    "qué tipo de {seed} hay",
    "qué {seed} regalar",
    "qué marca de {seed} es mejor",
  ],
  como: [
    "cómo comprar {seed} al por mayor",
    "cómo elegir {seed}",
    "cómo usar {seed}",
    "cómo importar {seed} de China",
    "cómo encontrar {seed} baratos",
    "cómo vender {seed} por internet",
    "cómo saber si {seed} son originales",
    "cómo comparar {seed} de calidad",
  ],
  donde: [
    "dónde comprar {seed} al por mayor",
    "dónde venden {seed} baratos",
    "dónde comprar {seed} en línea",
    "dónde encontrar {seed} importados",
    "dónde conseguir {seed} al mejor precio",
    "dónde comprar {seed} originales",
    "dónde hay {seed} cerca de mí",
  ],
  cuando: [
    "cuándo comprar {seed} más baratos",
    "cuándo hay ofertas de {seed}",
    "cuándo llegan {seed} nuevos",
    "cuándo es temporada de {seed}",
    "cuándo conviene comprar {seed} al por mayor",
  ],
  por_que: [
    "por qué comprar {seed} al por mayor",
    "por qué {seed} importados son más baratos",
    "por qué {seed} de China son populares",
    "por qué elegir Mega Mayorista para {seed}",
    "por qué {seed} están de moda en TikTok",
  ],
  cual: [
    "cuál es el mejor {seed}",
    "cuál {seed} conviene más",
    "cuál es la diferencia entre {seed}",
    "cuáles son los {seed} más vendidos",
    "cuáles {seed} recomienda Mega Mayorista",
    "cuál {seed} tiene mejor relación calidad-precio",
  ],
  quien: [
    "quién vende {seed} al por mayor",
    "quién es Mega Mayorista",
    "quién distribuye {seed} en LATAM",
    "quién tiene los mejores precios en {seed}",
  ],
};

// 2. PREPOSICIONES
const PREPOSITIONS = {
  para: [
    "{seed} para revender",
    "{seed} para negocio",
    "{seed} para tienda",
    "{seed} para regalo",
    "{seed} para emprendedores",
    "{seed} para vender en redes sociales",
    "{seed} para el día de la madre",
    "{seed} para niños",
    "{seed} para mujeres",
    "{seed} para hombres",
  ],
  con: [
    "{seed} con envío gratis",
    "{seed} con garantía",
    "{seed} con descuento por mayoreo",
    "{seed} con precio de fábrica",
    "{seed} con buenas reseñas",
    "{seed} con mejor calidad",
  ],
  sin: [
    "{seed} sin intermediarios",
    "{seed} sin mínimo de compra",
    "{seed} sin marca genéricos",
    "{seed} sin costos ocultos",
  ],
  cerca_de: [
    "{seed} cerca de mí",
    "{seed} distribuidor cerca",
    "mayorista de {seed} cerca de mi ciudad",
    "tienda de {seed} cerca",
  ],
  como: [
    "{seed} como los de TikTok",
    "{seed} como los de AliExpress pero más rápido",
    "{seed} como los que vende G&G",
    "{seed} como negocio rentable",
  ],
  desde: [
    "{seed} desde China",
    "{seed} desde fábrica",
    "{seed} desde $1",
    "{seed} desde mayorista",
  ],
  por: [
    "{seed} por mayor",
    "{seed} por docena",
    "{seed} por catálogo",
    "{seed} por lote",
    "{seed} por internet",
  ],
};

// 3. COMPARACIONES
const COMPARISONS = {
  vs: [
    "Mega Mayorista vs G&G {seed}",
    "{seed} importados vs nacionales",
    "{seed} de China vs originales",
    "{seed} al por mayor vs al detal",
    "comprar {seed} en tienda vs online",
    "AliExpress vs Mega Mayorista para {seed}",
    "{seed} baratos vs {seed} de marca",
  ],
  o: [
    "{seed} por mayor o por menor",
    "{seed} genéricos o de marca",
    "{seed} importados o nacionales",
    "Mega Mayorista o G&G para {seed}",
    "comprar {seed} online o en tienda física",
  ],
  mejor_que: [
    "{seed} Mega Mayorista mejor que G&G",
    "{seed} importados mejor que nacionales",
    "{seed} de catálogo mejor que los de tienda",
    "precios {seed} Mega Mayorista mejor que competencia",
  ],
  diferencia: [
    "diferencia entre {seed} original y réplica",
    "diferencia entre {seed} al por mayor y al detal",
    "diferencia entre Mega Mayorista y G&G en {seed}",
    "diferencia entre {seed} de China y {seed} de marca",
  ],
};

// 4. RELACIONADAS
const RELATED = {
  comerciales: [
    "{seed} precio mayorista",
    "{seed} catálogo 2025",
    "{seed} proveedor confiable",
    "{seed} lote completo",
    "{seed} distribuidor autorizado",
    "{seed} stock disponible",
    "{seed} precio por unidad",
    "{seed} margen de ganancia",
    "catálogo Mega Mayorista {seed}",
    "ofertas {seed} al por mayor",
  ],
  tendencias: [
    "{seed} más vendidos 2025",
    "{seed} virales en TikTok",
    "{seed} trending",
    "{seed} novedades",
    "{seed} nuevos lanzamientos",
    "{seed} populares en redes",
    "{seed} que se venden solos",
    "{seed} para emprendimiento",
    "{seed} negocio rentable",
    "{seed} alta rotación",
  ],
  competencia: [
    "G&G {seed} precios",
    "G&G vs Mega Mayorista {seed}",
    "alternativas a G&G para {seed}",
    "mayoristas de {seed} en Latinoamérica",
    "mejores proveedores de {seed}",
    "distribuidores {seed} confiables",
  ],
};

// 5. ALFABÉTICAS
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

const ALPHABETICAL_MODIFIERS = {
  a: ["al por mayor", "accesorios", "amazon", "aliexpress", "alta calidad", "al mejor precio"],
  b: ["baratos", "buena calidad", "bonitos", "buenos", "belleza", "bluetooth"],
  c: ["catálogo", "china", "calidad", "comprar", "con envío", "cerca de mí"],
  d: ["descuento", "distribuidor", "de marca", "de moda", "directo de fábrica", "docena"],
  e: ["económicos", "en línea", "en oferta", "envío gratis", "emprendimiento", "elegantes"],
  f: ["fábrica", "fiesta", "funcionan bien", "femeninos", "fotografía"],
  g: ["gadgets", "gratis", "garantía", "gaming", "genéricos", "G&G"],
  h: ["hogar", "hombres", "herramientas", "Halloween"],
  i: ["importados", "innovadores", "internet", "iluminación", "infantiles"],
  j: ["juguetes", "jóvenes", "japoneses"],
  k: ["kit completo", "kawaii", "k-beauty"],
  l: ["led", "lote", "luces", "limpieza", "Latinoamérica"],
  m: ["mayoreo", "Mega Mayorista", "moda", "maquillaje", "mujer", "mejor precio"],
  n: ["novedosos", "nuevos", "navidad", "niños", "negocio"],
  o: ["ofertas", "originales", "online", "organizadores"],
  p: ["precio", "proveedores", "por mayor", "populares", "premium"],
  q: ["que se venden rápido", "que están de moda", "que funcionan"],
  r: ["regalos", "revender", "recomendados", "réplicas", "rentable"],
  s: ["skincare", "smartwatch", "surtido", "stock", "sin marca"],
  t: ["tecnología", "TikTok", "trending", "tienda", "tiktok virales"],
  u: ["útiles", "unisex", "utensilios", "USB"],
  v: ["virales", "variedades", "vender", "variedad"],
  w: ["wireless", "wearables"],
  x: ["xiaomi"],
  y: ["y baratos", "y bonitos", "y útiles"],
  z: ["zona mayorista"],
};

// ============================================================================
// FUNCIONES DE GENERACIÓN
// ============================================================================

function expandTemplate(template, seed) {
  return template.replace(/\{seed\}/g, seed);
}

function generateQuestionsForSeed(seed) {
  const rows = [];
  for (const [questionType, templates] of Object.entries(QUESTION_WORDS)) {
    for (const template of templates) {
      rows.push({
        keyword_seed: seed,
        tipo_pregunta: questionType.replace("_", " "),
        keyword_generada: expandTemplate(template, seed),
        categoria_atp: "Preguntas",
        intent: "Informacional",
      });
    }
  }
  return rows;
}

function generatePrepositionsForSeed(seed) {
  const rows = [];
  for (const [prep, templates] of Object.entries(PREPOSITIONS)) {
    for (const template of templates) {
      rows.push({
        keyword_seed: seed,
        preposicion: prep.replace("_", " "),
        keyword_generada: expandTemplate(template, seed),
        categoria_atp: "Preposiciones",
        intent: "Transaccional / Navegacional",
      });
    }
  }
  return rows;
}

function generateComparisonsForSeed(seed) {
  const rows = [];
  for (const [compType, templates] of Object.entries(COMPARISONS)) {
    for (const template of templates) {
      rows.push({
        keyword_seed: seed,
        tipo_comparacion: compType.replace("_", " "),
        keyword_generada: expandTemplate(template, seed),
        categoria_atp: "Comparaciones",
        intent: "Comercial / Investigación",
      });
    }
  }
  return rows;
}

function generateRelatedForSeed(seed) {
  const rows = [];
  for (const [relType, templates] of Object.entries(RELATED)) {
    for (const template of templates) {
      rows.push({
        keyword_seed: seed,
        subtipo: relType,
        keyword_generada: expandTemplate(template, seed),
        categoria_atp: "Relacionadas",
        intent:
          relType === "comerciales"
            ? "Transaccional"
            : relType === "tendencias"
            ? "Informacional / Comercial"
            : "Comercial / Competitiva",
      });
    }
  }
  return rows;
}

function generateAlphabeticalForSeed(seed) {
  const rows = [];
  for (const letter of ALPHABET) {
    const modifiers = ALPHABETICAL_MODIFIERS[letter] || [];
    for (const mod of modifiers) {
      rows.push({
        keyword_seed: seed,
        letra: letter.toUpperCase(),
        keyword_generada: `${seed} ${mod}`,
        categoria_atp: "Alfabéticas",
        intent: "Long-tail / Variación",
      });
    }
  }
  return rows;
}

// ============================================================================
// GENERACIÓN POR BUSCADOR
// ============================================================================

function getSearchEngineContext(engineId, keyword) {
  const contexts = {
    google: {
      plataforma: "Google",
      tipo_busqueda: "Web / SEO",
      uso_contenido: "Blog, Landing pages, SEO on-page",
      formato_sugerido: "Artículo SEO / FAQ / Guía de compra",
    },
    youtube: {
      plataforma: "YouTube",
      tipo_busqueda: "Video / Tutoriales",
      uso_contenido: "Videos, Tutoriales, Reviews, Unboxing",
      formato_sugerido: "Video script / Thumbnail + descripción SEO",
    },
    tiktok: {
      plataforma: "TikTok",
      tipo_busqueda: "Short-form video / Trends",
      uso_contenido: "Reels cortos, hooks virales, trends",
      formato_sugerido: "Script 15-60s / Hook en 3s / CTA",
    },
    amazon: {
      plataforma: "Amazon",
      tipo_busqueda: "E-commerce / Producto",
      uso_contenido: "Listados, fichas de producto, comparativas",
      formato_sugerido: "Ficha de producto / Comparativa / Review",
    },
    instagram: {
      plataforma: "Instagram",
      tipo_busqueda: "Visual / Social",
      uso_contenido: "Carousels, Reels, Stories, Captions",
      formato_sugerido: "Caption + hashtags / Carousel educativo / Reel",
    },
  };
  return contexts[engineId] || contexts.google;
}

// ============================================================================
// CONTEXTO TÉCNICO DE LA EMPRESA
// ============================================================================

function generateCompanyContextSheet() {
  return [
    {
      campo: "Nombre Empresa",
      valor: "Mega Mayorista",
      notas: "Marca principal para todo el contenido SEO y RRSS",
    },
    {
      campo: "Giro del Negocio",
      valor: "Distribución mayorista y minorista de productos importados",
      notas: "Modelo B2B y B2C simultáneo",
    },
    {
      campo: "Verticales de Producto",
      valor: "Tecnología, Belleza, Hogar, Variedades",
      notas: "4 verticales principales que definen la estructura de keywords",
    },
    {
      campo: "Origen de Productos",
      valor: "Importados de China (AliExpress, fabricantes directos)",
      notas: "Diferenciador de precio vs productos nacionales",
    },
    {
      campo: "Mercado Objetivo",
      valor: "Latinoamérica (LATAM)",
      notas: "Español LATAM, no español de España",
    },
    {
      campo: "Tipos de Cliente",
      valor: "Emprendedores, revendedores, tiendas, consumidor final",
      notas: "Contenido debe hablar a ambos segmentos (mayoreo y detal)",
    },
    {
      campo: "Competencia Directa",
      valor: "G&G",
      notas: "Keywords comparativas y de diferenciación son prioritarias",
    },
    {
      campo: "Canales de Contenido",
      valor: "TikTok, Facebook, Instagram, YouTube, Blog SEO",
      notas: "Cada plataforma requiere formato y tono diferente",
    },
    {
      campo: "Propuesta de Valor",
      valor: "Precios de fábrica, variedad, envío rápido, sin intermediarios",
      notas: "Estos USP deben reflejarse en el contenido generado",
    },
    {
      campo: "Estrategia SEO",
      valor: "Long-tail keywords en español LATAM con intención comercial",
      notas: "Priorizar keywords transaccionales y con volumen comprobable",
    },
    {
      campo: "Modelo de Contenido",
      valor: "Pipeline automatizado: Keywords → Ranking → Scripts → Diseño → Publicación",
      notas: "100% automatizado sin checkpoints humanos",
    },
    {
      campo: "Referencia ATP",
      valor: "AnswerThePublic (answerthepublic.com)",
      notas: "Estructura de 5 categorías: Preguntas, Preposiciones, Comparaciones, Relacionadas, Alfabéticas",
    },
  ];
}

// ============================================================================
// GENERACIÓN DE ESTRATEGIA POR BUSCADOR
// ============================================================================

function generateSearchEngineStrategySheet() {
  return [
    {
      buscador: "Google",
      tipo_trafico: "Orgánico SEO",
      intencion_principal: "Informacional + Transaccional",
      formatos_contenido: "Artículos blog, FAQs, guías de compra, landing pages",
      keywords_prioritarias: "Long-tail con intención de compra. Ej: 'dónde comprar gadgets al por mayor baratos'",
      metricas_clave: "Posición SERP, CTR, tráfico orgánico, conversiones",
      estrategia_mega: "Dominar búsquedas tipo 'mayorista de [producto]' y 'comprar [producto] al por mayor'",
      vs_competencia: "Crear contenido más completo que G&G en cada categoría de producto",
    },
    {
      buscador: "YouTube",
      tipo_trafico: "Orgánico video",
      intencion_principal: "Informacional + Descubrimiento",
      formatos_contenido: "Unboxing, reviews, comparativas, tutoriales, top 10",
      keywords_prioritarias: "Review + nombre producto, unboxing, mejores [producto] 2025",
      metricas_clave: "Vistas, CTR thumbnail, retención, suscriptores",
      estrategia_mega: "Videos de unboxing y comparativa de productos del catálogo con CTA a tienda",
      vs_competencia: "Más frecuencia y mejor producción que el canal de G&G",
    },
    {
      buscador: "TikTok",
      tipo_trafico: "Orgánico viral / Algoritmo For You",
      intencion_principal: "Descubrimiento + Viral",
      formatos_contenido: "Videos 15-60s, hooks virales, trends, POV, antes/después",
      keywords_prioritarias: "Productos virales TikTok, gadgets que no sabías que existían, hacks",
      metricas_clave: "Vistas, compartidos, saves, comentarios, seguidores",
      estrategia_mega: "Hooks en 3 segundos mostrando productos 'wow' del catálogo",
      vs_competencia: "Velocidad de publicación y engagement superior a G&G",
    },
    {
      buscador: "Amazon",
      tipo_trafico: "E-commerce / Marketplace",
      intencion_principal: "Transaccional directa",
      formatos_contenido: "Fichas de producto, títulos optimizados, bullet points, A+ content",
      keywords_prioritarias: "[producto] + atributo + beneficio. Ej: 'audífonos bluetooth impermeables baratos'",
      metricas_clave: "Posición en búsqueda, tasa conversión, reseñas, BSR",
      estrategia_mega: "Optimizar listados con keywords de alta intención comercial",
      vs_competencia: "Mejor precio y más reseñas que listados de G&G",
    },
    {
      buscador: "Instagram",
      tipo_trafico: "Orgánico social / Explore",
      intencion_principal: "Visual + Engagement",
      formatos_contenido: "Carousels educativos, Reels, Stories, captions con hashtags",
      keywords_prioritarias: "Hashtags de nicho: #productosimportados #gadgetsbaratos #mayorista",
      metricas_clave: "Alcance, engagement rate, guardados, compartidos, seguidores",
      estrategia_mega: "Carousels '5 productos que no sabías que necesitas' con link en bio",
      vs_competencia: "Estética más profesional y consistencia de publicación vs G&G",
    },
  ];
}

// ============================================================================
// MAIN: GENERACIÓN DEL EXCEL
// ============================================================================

function main() {
  console.log("🚀 Generando Excel de Keywords para Mega Mayorista...\n");

  const wb = XLSX.utils.book_new();

  // ---------------------------------------------------
  // HOJA 1: Contexto Técnico de la Empresa
  // ---------------------------------------------------
  console.log("📋 Generando hoja: Contexto Empresa...");
  const contextData = generateCompanyContextSheet();
  const wsContext = XLSX.utils.json_to_sheet(contextData);
  wsContext["!cols"] = [{ wch: 25 }, { wch: 65 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsContext, "Contexto Empresa");

  // ---------------------------------------------------
  // HOJA 2: Estrategia por Buscador
  // ---------------------------------------------------
  console.log("🔍 Generando hoja: Estrategia por Buscador...");
  const strategyData = generateSearchEngineStrategySheet();
  const wsStrategy = XLSX.utils.json_to_sheet(strategyData);
  wsStrategy["!cols"] = [
    { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 55 },
    { wch: 65 }, { wch: 45 }, { wch: 60 }, { wch: 55 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStrategy, "Estrategia Buscadores");

  // ---------------------------------------------------
  // HOJAS 3-6: Keywords por Vertical (una hoja por vertical)
  // ---------------------------------------------------
  let totalKeywords = 0;

  for (const [verticalId, vertical] of Object.entries(VERTICALS)) {
    console.log(`📝 Generando hoja: ${vertical.name}...`);

    const allRows = [];

    for (const seed of vertical.seeds) {
      // Generar las 5 categorías ATP para cada seed
      const questions = generateQuestionsForSeed(seed);
      const prepositions = generatePrepositionsForSeed(seed);
      const comparisons = generateComparisonsForSeed(seed);
      const related = generateRelatedForSeed(seed);
      const alphabetical = generateAlphabeticalForSeed(seed);

      // Agregar contexto de buscador a cada fila
      for (const engine of SEARCH_ENGINES) {
        const ctx = getSearchEngineContext(engine.id);

        const addEngineContext = (rows) =>
          rows.map((row) => ({
            ...row,
            buscador: ctx.plataforma,
            tipo_busqueda: ctx.tipo_busqueda,
            formato_sugerido: ctx.formato_sugerido,
          }));

        allRows.push(...addEngineContext(questions));
        allRows.push(...addEngineContext(prepositions));
        allRows.push(...addEngineContext(comparisons));
        allRows.push(...addEngineContext(related));
        allRows.push(...addEngineContext(alphabetical));
      }
    }

    totalKeywords += allRows.length;

    const ws = XLSX.utils.json_to_sheet(allRows);
    ws["!cols"] = [
      { wch: 30 }, { wch: 18 }, { wch: 65 }, { wch: 18 },
      { wch: 28 }, { wch: 14 }, { wch: 22 }, { wch: 40 },
    ];
    // Añadir autofilter
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: allRows.length, c: 7 } }) };

    XLSX.utils.book_append_sheet(wb, ws, vertical.name);
  }

  // ---------------------------------------------------
  // HOJA 7: Resumen Consolidado (top keywords por categoría)
  // ---------------------------------------------------
  console.log("📊 Generando hoja: Resumen Consolidado...");

  const summaryRows = [];
  for (const [verticalId, vertical] of Object.entries(VERTICALS)) {
    for (const seed of vertical.seeds) {
      // Una fila resumen por seed con conteos
      const qCount = generateQuestionsForSeed(seed).length;
      const pCount = generatePrepositionsForSeed(seed).length;
      const cCount = generateComparisonsForSeed(seed).length;
      const rCount = generateRelatedForSeed(seed).length;
      const aCount = generateAlphabeticalForSeed(seed).length;
      const total = (qCount + pCount + cCount + rCount + aCount) * SEARCH_ENGINES.length;

      summaryRows.push({
        vertical: vertical.name,
        keyword_seed: seed,
        preguntas: qCount,
        preposiciones: pCount,
        comparaciones: cCount,
        relacionadas: rCount,
        alfabeticas: aCount,
        total_por_seed: qCount + pCount + cCount + rCount + aCount,
        total_x_buscadores: total,
      });
    }
  }

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 15 }, { wch: 35 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Consolidado");

  // ---------------------------------------------------
  // HOJA 8: Keywords de Marca y Competencia
  // ---------------------------------------------------
  console.log("🏢 Generando hoja: Marca y Competencia...");

  const brandRows = [
    // Keywords de marca Mega Mayorista
    { tipo: "Marca Propia", keyword: "Mega Mayorista", intent: "Navegacional", prioridad: "Alta", notas: "Keyword principal de marca" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista catálogo", intent: "Navegacional", prioridad: "Alta", notas: "Búsqueda directa de catálogo" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista precios", intent: "Transaccional", prioridad: "Alta", notas: "Usuarios buscando precios" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista productos", intent: "Informacional", prioridad: "Alta", notas: "Exploración de catálogo" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista envíos", intent: "Navegacional", prioridad: "Media", notas: "Consulta logística" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista ofertas", intent: "Transaccional", prioridad: "Alta", notas: "Alta intención de compra" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista opiniones", intent: "Informacional", prioridad: "Media", notas: "Social proof / reputación" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista tienda en línea", intent: "Navegacional", prioridad: "Alta", notas: "Búsqueda directa de ecommerce" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista mayoreo", intent: "Transaccional", prioridad: "Alta", notas: "Segmento B2B" },
    { tipo: "Marca Propia", keyword: "Mega Mayorista WhatsApp", intent: "Navegacional", prioridad: "Media", notas: "Canal de contacto directo" },

    // Keywords competitivas G&G
    { tipo: "Competencia - G&G", keyword: "G&G productos", intent: "Navegacional (competidor)", prioridad: "Alta", notas: "Monitorear para content gap" },
    { tipo: "Competencia - G&G", keyword: "G&G precios mayoreo", intent: "Transaccional (competidor)", prioridad: "Alta", notas: "Comparativa de precios" },
    { tipo: "Competencia - G&G", keyword: "G&G catálogo", intent: "Navegacional (competidor)", prioridad: "Alta", notas: "Analizar su oferta" },
    { tipo: "Competencia - G&G", keyword: "G&G opiniones", intent: "Informacional (competidor)", prioridad: "Media", notas: "Reputación del competidor" },
    { tipo: "Competencia - G&G", keyword: "alternativas a G&G", intent: "Comercial", prioridad: "Muy Alta", notas: "Oportunidad directa de captación" },
    { tipo: "Competencia - G&G", keyword: "G&G vs Mega Mayorista", intent: "Comercial", prioridad: "Muy Alta", notas: "Keyword de conquista clave" },
    { tipo: "Competencia - G&G", keyword: "mejor que G&G", intent: "Comercial", prioridad: "Alta", notas: "Content para diferenciación" },
    { tipo: "Competencia - G&G", keyword: "G&G envíos", intent: "Navegacional (competidor)", prioridad: "Media", notas: "Benchmarking logístico" },

    // Keywords comparativas directas
    { tipo: "Comparativa Directa", keyword: "Mega Mayorista o G&G cuál es mejor", intent: "Comercial", prioridad: "Muy Alta", notas: "Crear contenido comparativo" },
    { tipo: "Comparativa Directa", keyword: "Mega Mayorista vs G&G precios", intent: "Comercial", prioridad: "Muy Alta", notas: "Tabla comparativa de precios" },
    { tipo: "Comparativa Directa", keyword: "qué mayorista es mejor G&G o Mega Mayorista", intent: "Comercial", prioridad: "Muy Alta", notas: "FAQ / Blog post comparativo" },
    { tipo: "Comparativa Directa", keyword: "Mega Mayorista vs G&G envíos", intent: "Comercial", prioridad: "Alta", notas: "Diferenciador logístico" },
    { tipo: "Comparativa Directa", keyword: "Mega Mayorista vs G&G catálogo", intent: "Comercial", prioridad: "Alta", notas: "Variedad de productos como USP" },
    { tipo: "Comparativa Directa", keyword: "Mega Mayorista vs G&G garantía", intent: "Comercial", prioridad: "Media", notas: "Confianza y servicio post-venta" },
  ];

  const wsBrand = XLSX.utils.json_to_sheet(brandRows);
  wsBrand["!cols"] = [
    { wch: 22 }, { wch: 50 }, { wch: 30 }, { wch: 12 }, { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsBrand, "Marca y Competencia");

  // ---------------------------------------------------
  // HOJA 9: Ideas de Contenido (preguntas para blog/video)
  // ---------------------------------------------------
  console.log("💡 Generando hoja: Ideas de Contenido...");

  const contentIdeas = [
    // Blog SEO
    { plataforma: "Blog SEO", titulo_contenido: "Guía completa: Cómo comprar productos al por mayor en 2025", keyword_principal: "comprar productos al por mayor", tipo_contenido: "Guía", vertical: "General", prioridad: "Alta" },
    { plataforma: "Blog SEO", titulo_contenido: "Mega Mayorista vs G&G: Comparativa completa de precios y servicio", keyword_principal: "Mega Mayorista vs G&G", tipo_contenido: "Comparativa", vertical: "General", prioridad: "Muy Alta" },
    { plataforma: "Blog SEO", titulo_contenido: "10 gadgets tecnológicos más vendidos que puedes revender", keyword_principal: "gadgets tecnológicos para revender", tipo_contenido: "Listicle", vertical: "Tecnología", prioridad: "Alta" },
    { plataforma: "Blog SEO", titulo_contenido: "Productos de belleza coreanos: guía de compra al por mayor", keyword_principal: "productos belleza coreanos al por mayor", tipo_contenido: "Guía", vertical: "Belleza", prioridad: "Alta" },
    { plataforma: "Blog SEO", titulo_contenido: "Artículos para el hogar importados: lo que necesitas saber", keyword_principal: "artículos hogar importados", tipo_contenido: "Informativo", vertical: "Hogar", prioridad: "Media" },
    { plataforma: "Blog SEO", titulo_contenido: "Cómo iniciar un negocio de reventa con productos importados", keyword_principal: "negocio reventa productos importados", tipo_contenido: "Tutorial", vertical: "General", prioridad: "Alta" },
    { plataforma: "Blog SEO", titulo_contenido: "Los 20 productos más virales de TikTok que puedes encontrar en Mega Mayorista", keyword_principal: "productos virales TikTok mayoreo", tipo_contenido: "Listicle", vertical: "Variedades", prioridad: "Muy Alta" },
    { plataforma: "Blog SEO", titulo_contenido: "FAQ: Todo sobre comprar al por mayor en Mega Mayorista", keyword_principal: "comprar al por mayor Mega Mayorista", tipo_contenido: "FAQ", vertical: "General", prioridad: "Alta" },

    // TikTok
    { plataforma: "TikTok", titulo_contenido: "POV: Descubriste que este gadget existe 🤯", keyword_principal: "gadgets que no sabías que existían", tipo_contenido: "Hook viral", vertical: "Tecnología", prioridad: "Muy Alta" },
    { plataforma: "TikTok", titulo_contenido: "5 productos de belleza que cambiaron mi rutina", keyword_principal: "productos belleza virales", tipo_contenido: "Antes/Después", vertical: "Belleza", prioridad: "Alta" },
    { plataforma: "TikTok", titulo_contenido: "Productos de cocina que se venden solos 🔥", keyword_principal: "utensilios cocina novedosos", tipo_contenido: "Showcase", vertical: "Hogar", prioridad: "Alta" },
    { plataforma: "TikTok", titulo_contenido: "Empezé mi negocio con $100 en productos al por mayor", keyword_principal: "negocio productos mayoreo", tipo_contenido: "Storytelling", vertical: "General", prioridad: "Muy Alta" },

    // YouTube
    { plataforma: "YouTube", titulo_contenido: "UNBOXING: Los 10 gadgets más vendidos de Mega Mayorista", keyword_principal: "unboxing gadgets mayoreo", tipo_contenido: "Unboxing", vertical: "Tecnología", prioridad: "Alta" },
    { plataforma: "YouTube", titulo_contenido: "Review honesto: ¿Valen la pena los productos de China?", keyword_principal: "productos importados China review", tipo_contenido: "Review", vertical: "General", prioridad: "Alta" },
    { plataforma: "YouTube", titulo_contenido: "TOP 15 productos para revender en 2025 | Alta ganancia", keyword_principal: "productos para revender 2025", tipo_contenido: "Top / Ranking", vertical: "General", prioridad: "Muy Alta" },
    { plataforma: "YouTube", titulo_contenido: "Mega Mayorista vs G&G: ¿Cuál conviene más? | Comparativa real", keyword_principal: "Mega Mayorista vs G&G comparativa", tipo_contenido: "Comparativa", vertical: "General", prioridad: "Muy Alta" },

    // Instagram
    { plataforma: "Instagram", titulo_contenido: "Carousel: 5 razones para comprar al por mayor en Mega Mayorista", keyword_principal: "comprar al por mayor ventajas", tipo_contenido: "Carousel educativo", vertical: "General", prioridad: "Alta" },
    { plataforma: "Instagram", titulo_contenido: "Reel: Antes y después de organizar tu cocina con estos productos", keyword_principal: "organizadores cocina", tipo_contenido: "Reel", vertical: "Hogar", prioridad: "Media" },
    { plataforma: "Instagram", titulo_contenido: "Carousel: Kit de skincare coreano completo por menos de $20", keyword_principal: "skincare coreano barato", tipo_contenido: "Carousel producto", vertical: "Belleza", prioridad: "Alta" },

    // Facebook
    { plataforma: "Facebook", titulo_contenido: "¿Ya conoces el catálogo nuevo de Mega Mayorista? 😱 Más de 500 productos disponibles", keyword_principal: "catálogo Mega Mayorista", tipo_contenido: "Post engagement", vertical: "General", prioridad: "Alta" },
    { plataforma: "Facebook", titulo_contenido: "TESTIMONIO: Cómo pasé de 0 a vender $5,000 al mes revendiendo productos", keyword_principal: "negocio reventa mayoreo", tipo_contenido: "Storytelling", vertical: "General", prioridad: "Muy Alta" },
    { plataforma: "Facebook", titulo_contenido: "OFERTA FLASH: Solo por hoy, gadgets con 30% de descuento al por mayor", keyword_principal: "ofertas gadgets mayoreo", tipo_contenido: "Promo", vertical: "Tecnología", prioridad: "Alta" },
  ];

  const wsContent = XLSX.utils.json_to_sheet(contentIdeas);
  wsContent["!cols"] = [
    { wch: 14 }, { wch: 70 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsContent, "Ideas de Contenido");

  // ---------------------------------------------------
  // ESCRIBIR ARCHIVO
  // ---------------------------------------------------
  const outputPath = path.join(
    __dirname,
    "output",
    "MegaMayorista_Keywords_AnswerThePublic.xlsx"
  );

  // Asegurar que existe el directorio output
  const fs = require("fs");
  const outputDir = path.join(__dirname, "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  XLSX.writeFile(wb, outputPath);

  // ---------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("✅ EXCEL GENERADO EXITOSAMENTE");
  console.log("=".repeat(60));
  console.log(`📁 Archivo: ${outputPath}`);
  console.log(`\n📊 Contenido del Excel:`);
  console.log(`   1. Contexto Empresa          - ${contextData.length} campos`);
  console.log(`   2. Estrategia Buscadores      - ${strategyData.length} buscadores`);

  let verticalCount = 0;
  for (const [, vertical] of Object.entries(VERTICALS)) {
    verticalCount++;
    console.log(`   ${verticalCount + 2}. ${vertical.name.padEnd(24)} - ${vertical.seeds.length} seeds`);
  }

  console.log(`   7. Resumen Consolidado        - ${summaryRows.length} semillas`);
  console.log(`   8. Marca y Competencia        - ${brandRows.length} keywords`);
  console.log(`   9. Ideas de Contenido         - ${contentIdeas.length} ideas`);
  console.log(`\n📈 Total keywords generadas:     ${totalKeywords.toLocaleString()}`);
  console.log(`🔍 Buscadores cubiertos:         ${SEARCH_ENGINES.length} (Google, YouTube, TikTok, Amazon, Instagram)`);
  console.log(`📂 Verticales:                   ${Object.keys(VERTICALS).length} (Tecnología, Belleza, Hogar, Variedades)`);
  console.log(`🏷️  Categorías ATP:               5 (Preguntas, Preposiciones, Comparaciones, Relacionadas, Alfabéticas)`);
  console.log("=".repeat(60));
}

main();
