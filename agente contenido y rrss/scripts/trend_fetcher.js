/**
 * Módulo de Tendencias en Tiempo Real
 * Consulta Google Autocomplete para obtener lo que la gente busca AHORA
 * Se ejecuta cada vez que se compila el agente de SEO y RRSS
 *
 * APIs gratuitas usadas:
 *   - Google Autocomplete (suggestqueries.google.com)
 *   - YouTube Autocomplete (suggestqueries.google.com/complete/search?client=youtube)
 *   - TikTok Autocomplete (www.tiktok.com/api/search/suggest/keyword)
 */

const https = require("https");

// ============================================================================
// COMPETIDORES EXPANDIDOS (investigación real de mercado LATAM)
// ============================================================================
const COMPETITORS = {
  directos: [
    { nombre: "G&G Importadores", pais: "Colombia/Ecuador", fuerte: "Distribución directa" },
    { nombre: "Importadora GYG VIP", pais: "Ecuador", fuerte: "16 tiendas + 575K TikTok" },
    { nombre: "Colombia X Mayor", pais: "Colombia", fuerte: "Nacional, envío gratis" },
    { nombre: "Mayoreo.VIP", pais: "México", fuerte: "Viral, productos trending" },
    { nombre: "De Novedad", pais: "México", fuerte: "12 años, cosméticos y novedades" },
  ],
  regionales: [
    { nombre: "Mayoristar", pais: "Argentina", fuerte: "Mayor surtido online" },
    { nombre: "Markbal", pais: "Argentina", fuerte: "Relación directa con fábricas" },
    { nombre: "Asia Mayorista", pais: "Argentina", fuerte: "Juguetes y fiestas" },
    { nombre: "Sharwinn", pais: "Perú", fuerte: "Importadora Lima" },
    { nombre: "Distribuidora Pop", pais: "Argentina", fuerte: "Sin mínimo de compra" },
  ],
  intermediarios: [
    { nombre: "Chilat", pais: "China/LATAM", fuerte: "80 profesionales en Yiwu" },
    { nombre: "LatinChina Group", pais: "China/LATAM", fuerte: "10 años, full pipeline" },
    { nombre: "AliExpress", pais: "Global", fuerte: "Referencia de precios" },
  ],
};

// Nombres cortos para badges en miniaturas
const COMPETITOR_NAMES_SHORT = [
  "vs G&G", "vs GYG VIP", "vs ColombiaXMayor",
  "vs Mayoreo.VIP", "vs DeNovedad", "vs Mayoristar",
  "vs AliExpress", "vs Chilat",
];

// ============================================================================
// SEMILLAS PARA TENDENCIAS POR VERTICAL (pool expandido para variedad)
// Cada ejecución selecciona un subconjunto aleatorio diferente
// ============================================================================
const TREND_SEEDS = {
  tecnologia: [
    "gadgets", "audífonos inalámbricos", "accesorios celular",
    "smartwatch barato", "luces LED", "power bank",
    "cargador rápido", "funda celular", "cámara de seguridad wifi",
    "parlante bluetooth", "mouse inalámbrico", "teclado gamer",
    "ring light", "drone barato", "control remoto universal",
    "cable USB tipo C", "protector de pantalla", "soporte celular",
  ],
  belleza: [
    "skincare coreano", "maquillaje importado", "sérum facial",
    "brochas maquillaje", "pestañas postizas",
    "crema hidratante", "protector solar facial", "labial mate",
    "base maquillaje", "delineador ojos", "mascarilla facial",
    "aceite de rosa mosqueta", "uñas acrilicas", "esponja maquillaje",
    "paleta de sombras", "contorno facial", "agua micelar",
  ],
  hogar: [
    "organizadores hogar", "utensilios cocina", "gadgets cocina",
    "decoración hogar", "productos limpieza",
    "cortinas decorativas", "almohada ortopédica", "lámpara de mesa",
    "set de cuchillos", "tapete antideslizante", "organizador closet",
    "difusor de aromas", "plantas artificiales", "contenedores herméticos",
    "repisas flotantes", "cojines decorativos", "vajilla moderna",
  ],
  variedades: [
    "productos virales TikTok", "regalos originales", "juguetes novedosos",
    "artículos fiesta", "productos trending",
    "peluches gigantes", "juegos de mesa", "artículos para mascotas",
    "mochilas escolares", "termos personalizados", "stickers decorativos",
    "lentes de sol", "gorras importadas", "accesorios para carro",
    "productos kawaii", "figuras coleccionables", "billeteras importadas",
  ],
  negocio: [
    "productos para revender", "negocio mayoreo", "importar de China",
    "comprar al por mayor", "productos alta ganancia",
    "dropshipping productos", "vender en redes sociales", "tienda online Ecuador",
    "emprender con poco capital", "proveedores mayoristas", "productos rentables 2026",
    "catálogo mayorista", "margen de ganancia", "productos importados baratos",
    "negocio desde casa", "venta por catálogo", "feria de importados",
  ],
};

// ============================================================================
// UTILIDADES PARA VARIEDAD EN CADA EJECUCIÓN
// ============================================================================

/** Shuffle array in place (Fisher-Yates) */
function shuffleArray(arr) {
  const a = [...arr]; // no mutar original
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Selecciona N semillas aleatorias de un array */
function pickRandomSeeds(seeds, count) {
  const shuffled = shuffleArray(seeds);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Genera modificadores temporales para variar las queries */
function getTimeSuffixes() {
  const now = new Date();
  const year = now.getFullYear();
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const month = monthNames[now.getMonth()];
  const suffixes = [
    `${year}`,
    `${month} ${year}`,
    "nuevo",
    "mejor",
    "barato",
    "oferta",
    "recomendado",
    "cual comprar",
    "precio",
    "donde comprar",
    "original",
    "bueno y barato",
  ];
  return shuffleArray(suffixes).slice(0, 3);
}

// ============================================================================
// GOOGLE AUTOCOMPLETE FETCHER
// ============================================================================
function fetchGoogleSuggestions(query, lang = "es", country = "mx") {
  return new Promise((resolve) => {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&hl=${lang}&gl=${country}`;

    https.get(url, (res) => {
      // Google returns charset=ISO-8859-1 — collect raw buffers, then decode as latin1
      const buffers = [];
      res.on("data", (chunk) => buffers.push(chunk));
      res.on("end", () => {
        try {
          const data = Buffer.concat(buffers).toString("latin1");
          const parsed = JSON.parse(data);
          resolve(parsed[1] || []);
        } catch {
          resolve([]);
        }
      });
    }).on("error", () => resolve([]));
  });
}

function fetchYouTubeSuggestions(query) {
  return new Promise((resolve) => {
    const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&hl=es&gl=MX`;

    https.get(url, (res) => {
      // YouTube also returns charset=ISO-8859-1 — collect raw buffers
      const buffers = [];
      res.on("data", (chunk) => buffers.push(chunk));
      res.on("end", () => {
        try {
          const data = Buffer.concat(buffers).toString("latin1");
          // YouTube returns JSONP, need to extract JSON
          const match = data.match(/\((.+)\)/);
          if (match) {
            const parsed = JSON.parse(match[1]);
            const suggestions = (parsed[1] || []).map((s) => s[0]);
            resolve(suggestions);
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    }).on("error", () => resolve([]));
  });
}

// ============================================================================
// TIKTOK AUTOCOMPLETE FETCHER
// ============================================================================
function fetchTikTokSuggestions(query) {
  return new Promise((resolve) => {
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
          // TikTok returns { sug_list: [{ content: "keyword" }, ...] }
          if (parsed.sug_list && Array.isArray(parsed.sug_list)) {
            resolve(parsed.sug_list.map(s => s.content).filter(Boolean));
          } else if (parsed.data && Array.isArray(parsed.data)) {
            resolve(parsed.data.map(s => s.content || s.keyword || s).filter(Boolean));
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    });

    req.on("error", () => resolve([]));
    req.on("timeout", () => { req.destroy(); resolve([]); });
  });
}

// ============================================================================
// FUNCIÓN PRINCIPAL: Obtener tendencias actuales
// ============================================================================
async function fetchCurrentTrends() {
  console.log("🔍 Consultando tendencias en tiempo real...\n");

  const trends = {};
  const allSuggestions = [];
  const SEEDS_PER_VERTICAL = 4; // Solo 4 semillas aleatorias por vertical (de 17+)
  const timeSuffixes = getTimeSuffixes();

  console.log(`   Variadores temporales: ${timeSuffixes.join(", ")}`);

  for (const [vertical, allSeeds] of Object.entries(TREND_SEEDS)) {
    trends[vertical] = [];

    // Seleccionar subconjunto ALEATORIO de semillas para esta ejecución
    const selectedSeeds = pickRandomSeeds(allSeeds, SEEDS_PER_VERTICAL);
    console.log(`   ${vertical}: usando ${selectedSeeds.length}/${allSeeds.length} semillas → [${selectedSeeds.join(", ")}]`);

    // Para cada semilla seleccionada, también hacer una query variada con sufijo temporal
    const queries = [];
    for (const seed of selectedSeeds) {
      queries.push({ query: seed, seed, isVariant: false });
      // Agregar 1 variante temporal aleatoria por semilla
      const suffix = pickRandomSeeds(timeSuffixes, 1)[0];
      queries.push({ query: `${seed} ${suffix}`, seed: `${seed} ${suffix}`, isVariant: true });
    }

    for (const { query, seed } of queries) {
      // Pequeño delay para no saturar
      await new Promise((r) => setTimeout(r, 150));

      const [googleResults, youtubeResults, tiktokResults] = await Promise.all([
        fetchGoogleSuggestions(query),
        fetchYouTubeSuggestions(query),
        fetchTikTokSuggestions(query),
      ]);

      const combined = [...new Set([...googleResults, ...youtubeResults, ...tiktokResults])];
      trends[vertical].push({
        seed,
        google: googleResults.slice(0, 5),
        youtube: youtubeResults.slice(0, 5),
        tiktok: tiktokResults.slice(0, 5),
        combined: combined.slice(0, 10),
      });

      allSuggestions.push(
        ...combined.map((s) => ({
          keyword: s,
          vertical,
          seed,
          sources: [
            googleResults.includes(s) ? "google" : null,
            youtubeResults.includes(s) ? "youtube" : null,
            tiktokResults.includes(s) ? "tiktok" : null,
          ].filter(Boolean),
        }))
      );
    }

    console.log(`  ✅ ${vertical}: ${trends[vertical].reduce((a, t) => a + t.combined.length, 0)} sugerencias`);
  }

  // Deduplicar y rankear por aparición en múltiples fuentes
  const keywordMap = new Map();
  for (const s of allSuggestions) {
    if (keywordMap.has(s.keyword)) {
      const existing = keywordMap.get(s.keyword);
      existing.count++;
      existing.sources = [...new Set([...existing.sources, ...s.sources])];
      if (!existing.verticals.includes(s.vertical)) {
        existing.verticals.push(s.vertical);
      }
    } else {
      keywordMap.set(s.keyword, {
        keyword: s.keyword,
        count: 1,
        sources: s.sources,
        verticals: [s.vertical],
        seed: s.seed,
      });
    }
  }

  const ranked = Array.from(keywordMap.values())
    .sort((a, b) => b.count - a.count || b.sources.length - a.sources.length);

  console.log(`\n📊 Total keywords únicas: ${ranked.length}`);
  console.log(`🔝 Top 10 tendencias actuales:`);
  ranked.slice(0, 10).forEach((k, i) => {
    console.log(`   ${i + 1}. "${k.keyword}" (${k.sources.join("+")} | ${k.verticals.join(", ")})`);
  });

  return {
    timestamp: new Date().toISOString(),
    trends_by_vertical: trends,
    all_keywords_ranked: ranked,
    top_20: ranked.slice(0, 20),
    competitors: COMPETITORS,
    competitor_names_short: COMPETITOR_NAMES_SHORT,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  fetchCurrentTrends,
  COMPETITORS,
  COMPETITOR_NAMES_SHORT,
  TREND_SEEDS,
  shuffleArray,
  pickRandomSeeds,
};
