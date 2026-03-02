/**
 * ORQUESTADOR PRINCIPAL V2 — Content Pack Generator
 * Mega Mayorista: Genera paquetes de contenido completos
 *
 * MEJORAS V2:
 *   - Foto de perfil real del presentador en miniaturas
 *   - Logo real de Mega Mayorista
 *   - Expresiones faciales contextuales (sorpresa, duda, urgencia, etc.)
 *   - Competidores expandidos (G&G, GYG VIP, ColombiaXMayor, Mayoreo.VIP, etc.)
 *   - Tendencias en tiempo real via Google/YouTube Autocomplete
 *   - Badges de competencia en miniaturas
 *
 * Uso: node generate_content_pack.js
 */

const fs = require("fs");
const path = require("path");
const { generateThumbnail } = require("./scripts/thumbnail_generator");
const {
  createWordDocument,
  generateTikTokScript,
  generateInstagramScript,
  generateFacebookScript,
  generateHashtags,
  Packer,
} = require("./scripts/word_generator");
const {
  fetchCurrentTrends,
  COMPETITORS,
  COMPETITOR_NAMES_SHORT,
} = require("./scripts/trend_fetcher");

// ============================================================================
// LAS 22 IDEAS DE CONTENIDO — COMPETIDORES EXPANDIDOS
// ============================================================================
const CONTENT_IDEAS = [
  // === BLOG SEO ===
  { plataforma: "Blog SEO", titulo_contenido: "Guía completa: Cómo comprar productos al por mayor en 2025", keyword_principal: "comprar productos al por mayor", tipo_contenido: "Guía", vertical: "General", prioridad: "Alta", competitors: ["vs G&G", "vs Mayoreo.VIP", "vs AliExpress"] },
  { plataforma: "Blog SEO", titulo_contenido: "Mega Mayorista vs la competencia: Comparativa de precios y servicio", keyword_principal: "Mega Mayorista vs competencia mayorista", tipo_contenido: "Comparativa", vertical: "General", prioridad: "Muy Alta", competitors: ["vs G&G", "vs GYG VIP", "vs ColombiaXMayor"] },
  { plataforma: "Blog SEO", titulo_contenido: "10 gadgets tecnológicos más vendidos que puedes revender", keyword_principal: "gadgets tecnológicos para revender", tipo_contenido: "Listicle", vertical: "Tecnología", prioridad: "Alta", competitors: ["vs AliExpress", "vs Mayoreo.VIP"] },
  { plataforma: "Blog SEO", titulo_contenido: "Productos de belleza coreanos: guía de compra al por mayor", keyword_principal: "productos belleza coreanos al por mayor", tipo_contenido: "Guía", vertical: "Belleza", prioridad: "Alta", competitors: ["vs DeNovedad", "vs Kroma"] },
  { plataforma: "Blog SEO", titulo_contenido: "Artículos para el hogar importados: lo que necesitas saber", keyword_principal: "artículos hogar importados", tipo_contenido: "Informativo", vertical: "Hogar", prioridad: "Media", competitors: ["vs ColombiaXMayor"] },
  { plataforma: "Blog SEO", titulo_contenido: "Cómo iniciar un negocio de reventa con productos importados", keyword_principal: "negocio reventa productos importados", tipo_contenido: "Tutorial", vertical: "General", prioridad: "Alta", competitors: ["vs Chilat", "vs LatinChina"] },
  { plataforma: "Blog SEO", titulo_contenido: "Los 20 productos más virales de TikTok que puedes encontrar en Mega Mayorista", keyword_principal: "productos virales TikTok mayoreo", tipo_contenido: "Listicle", vertical: "Variedades", prioridad: "Muy Alta", competitors: ["vs GYG VIP", "vs Mayoreo.VIP"] },
  { plataforma: "Blog SEO", titulo_contenido: "FAQ: Todo sobre comprar al por mayor en Mega Mayorista", keyword_principal: "comprar al por mayor Mega Mayorista", tipo_contenido: "FAQ", vertical: "General", prioridad: "Alta", competitors: ["vs G&G", "vs Mayoristar"] },

  // === TIKTOK ===
  { plataforma: "TikTok", titulo_contenido: "POV: Descubriste que este gadget existe", keyword_principal: "gadgets que no sabías que existían", tipo_contenido: "Hook viral", vertical: "Tecnología", prioridad: "Muy Alta", competitors: ["vs AliExpress"] },
  { plataforma: "TikTok", titulo_contenido: "5 productos de belleza que cambiaron mi rutina", keyword_principal: "productos belleza virales", tipo_contenido: "Antes/Después", vertical: "Belleza", prioridad: "Alta", competitors: ["vs DeNovedad"] },
  { plataforma: "TikTok", titulo_contenido: "Productos de cocina que se venden solos", keyword_principal: "utensilios cocina novedosos", tipo_contenido: "Showcase", vertical: "Hogar", prioridad: "Alta", competitors: ["vs Mayoreo.VIP"] },
  { plataforma: "TikTok", titulo_contenido: "Empecé mi negocio con $100 en productos al por mayor", keyword_principal: "negocio productos mayoreo", tipo_contenido: "Storytelling", vertical: "General", prioridad: "Muy Alta", competitors: ["vs G&G", "vs GYG VIP"] },

  // === YOUTUBE ===
  { plataforma: "YouTube", titulo_contenido: "UNBOXING: Los 10 gadgets más vendidos de Mega Mayorista", keyword_principal: "unboxing gadgets mayoreo", tipo_contenido: "Unboxing", vertical: "Tecnología", prioridad: "Alta", competitors: ["vs AliExpress", "vs Mayoreo.VIP"] },
  { plataforma: "YouTube", titulo_contenido: "Review honesto: ¿Valen la pena los productos importados de China?", keyword_principal: "productos importados China review", tipo_contenido: "Review", vertical: "General", prioridad: "Alta", competitors: ["vs Chilat", "vs G&G"] },
  { plataforma: "YouTube", titulo_contenido: "TOP 15 productos para revender en 2025 | Alta ganancia", keyword_principal: "productos para revender 2025", tipo_contenido: "Top / Ranking", vertical: "General", prioridad: "Muy Alta", competitors: ["vs G&G", "vs ColombiaXMayor", "vs Mayoristar"] },
  { plataforma: "YouTube", titulo_contenido: "Mega Mayorista vs G&G vs GYG VIP: ¿Cuál mayorista conviene más?", keyword_principal: "comparativa mayoristas LATAM", tipo_contenido: "Comparativa", vertical: "General", prioridad: "Muy Alta", competitors: ["vs G&G", "vs GYG VIP", "vs ColombiaXMayor"] },

  // === INSTAGRAM ===
  { plataforma: "Instagram", titulo_contenido: "5 razones para comprar al por mayor en Mega Mayorista", keyword_principal: "comprar al por mayor ventajas", tipo_contenido: "Carousel educativo", vertical: "General", prioridad: "Alta", competitors: ["vs G&G"] },
  { plataforma: "Instagram", titulo_contenido: "Antes y después de organizar tu cocina con estos productos", keyword_principal: "organizadores cocina", tipo_contenido: "Reel", vertical: "Hogar", prioridad: "Media", competitors: ["vs ColombiaXMayor"] },
  { plataforma: "Instagram", titulo_contenido: "Kit de skincare coreano completo por menos de $20", keyword_principal: "skincare coreano barato", tipo_contenido: "Carousel producto", vertical: "Belleza", prioridad: "Alta", competitors: ["vs DeNovedad", "vs Kroma"] },

  // === FACEBOOK ===
  { plataforma: "Facebook", titulo_contenido: "¿Ya conoces el catálogo nuevo de Mega Mayorista? Más de 500 productos disponibles", keyword_principal: "catálogo Mega Mayorista", tipo_contenido: "Post engagement", vertical: "General", prioridad: "Alta", competitors: ["vs G&G", "vs GYG VIP"] },
  { plataforma: "Facebook", titulo_contenido: "TESTIMONIO: Cómo pasé de 0 a vender $5,000 al mes revendiendo productos", keyword_principal: "negocio reventa mayoreo", tipo_contenido: "Storytelling", vertical: "General", prioridad: "Muy Alta", competitors: ["vs Mayoristar", "vs DistribuidoraPop"] },
  { plataforma: "Facebook", titulo_contenido: "OFERTA FLASH: Solo por hoy, gadgets con 30% de descuento al por mayor", keyword_principal: "ofertas gadgets mayoreo", tipo_contenido: "Promo", vertical: "Tecnología", prioridad: "Alta", competitors: ["vs Mayoreo.VIP", "vs AliExpress"] },
];

// ============================================================================
// HELPERS
// ============================================================================
function getVerticalKey(vertical) {
  const map = {
    "Tecnología": "tecnologia", Tecnologia: "tecnologia",
    Belleza: "belleza", Hogar: "hogar",
    Variedades: "variedades", General: "general",
  };
  return map[vertical] || "general";
}

function slugify(text) {
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")
    .toLowerCase().slice(0, 120);
}

const SOCIAL_PLATFORMS = ["tiktok", "instagram", "facebook"];

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║   MEGA MAYORISTA — Generador de Contenido RRSS V2              ║");
  console.log("║   Con foto de perfil • Logo real • Expresiones • Competidores   ║");
  console.log("║   TikTok • Instagram • Facebook                                ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  // ---- FASE 0: Tendencias en tiempo real ----
  console.log("━━━ FASE 0: Tendencias en Tiempo Real ━━━");
  let trendData = null;
  try {
    trendData = await fetchCurrentTrends();
    // Guardar tendencias
    const trendsPath = path.join(__dirname, "output", "tendencias_actuales.json");
    fs.writeFileSync(trendsPath, JSON.stringify(trendData, null, 2));
    console.log(`\n💾 Tendencias guardadas en: ${trendsPath}\n`);
  } catch (err) {
    console.log(`⚠️ No se pudieron obtener tendencias: ${err.message}\n`);
  }

  // ---- FASE 1: Generar paquetes de contenido ----
  console.log("━━━ FASE 1: Generación de Content Packs ━━━\n");

  const baseDir = path.join(__dirname, "output", "content_packs_v2");
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  let totalDocs = 0;
  let totalThumbs = 0;
  const errors = [];

  for (let i = 0; i < CONTENT_IDEAS.length; i++) {
    const idea = CONTENT_IDEAS[i];
    const ideaNum = String(i + 1).padStart(2, "0");
    const slug = slugify(idea.titulo_contenido);
    const folderName = `${ideaNum}_${slug}`;
    const ideaDir = path.join(baseDir, folderName);

    console.log(`\n${"─".repeat(65)}`);
    console.log(`📌 [${ideaNum}/22] ${idea.titulo_contenido}`);
    console.log(`   ${idea.plataforma} | ${idea.vertical} | Competidores: ${(idea.competitors || []).join(", ")}`);
    console.log(`${"─".repeat(65)}`);

    if (!fs.existsSync(ideaDir)) fs.mkdirSync(ideaDir, { recursive: true });

    for (const platform of SOCIAL_PLATFORMS) {
      try {
        const verticalKey = getVerticalKey(idea.vertical);

        // 1. MINIATURA (ahora async con foto+logo)
        const thumbPath = path.join(ideaDir, `thumbnail_${platform}.png`);

        await generateThumbnail({
          title: idea.titulo_contenido,
          subtitle: `${idea.tipo_contenido} • Mega Mayorista`,
          keyword: idea.keyword_principal,
          platform,
          vertical: verticalKey,
          ctaText: platform === "tiktok" ? "Sígueme" : platform === "instagram" ? "Link en bio" : "Ver más",
          tipoContenido: idea.tipo_contenido,
          competitors: idea.competitors || [],
          outputPath: thumbPath,
        });

        totalThumbs++;
        console.log(`   ✅ Thumb ${platform} (expresión contextual + foto + logo)`);

        // 2. GUIÓN
        let script;
        if (platform === "tiktok") script = generateTikTokScript(idea);
        else if (platform === "instagram") script = generateInstagramScript(idea);
        else script = generateFacebookScript(idea);

        // 3. HASHTAGS
        const hashtags = generateHashtags(idea, platform);

        // 4. DOCUMENTO WORD
        const doc = createWordDocument(idea, script, hashtags, thumbPath, platform);
        const platLabel = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" }[platform];
        const docPath = path.join(ideaDir, `Guion_${platLabel}_${slug.slice(0, 40)}.docx`);

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(docPath, buffer);
        totalDocs++;
        console.log(`   ✅ Word ${platform}: guión + ${hashtags.length} hashtags + miniatura`);

      } catch (err) {
        errors.push({ idea: idea.titulo_contenido, platform, error: err.message });
        console.log(`   ❌ Error ${platform}: ${err.message}`);
      }
    }
  }

  // ---- ÍNDICE MAESTRO ----
  console.log("\n📋 Generando índice maestro...");
  const indexLines = [
    "# MEGA MAYORISTA — Paquetes de Contenido RRSS V2",
    `Generado: ${new Date().toLocaleString("es-MX")}`,
    "",
    "## Mejoras V2",
    "- Foto de perfil del presentador en cada miniatura",
    "- Logo real de Mega Mayorista",
    "- Expresiones faciales contextuales (sorpresa, duda, urgencia, dinero, confianza, emoción)",
    "- Competidores expandidos: G&G, GYG VIP, ColombiaXMayor, Mayoreo.VIP, DeNovedad, Mayoristar, AliExpress, Chilat",
    "- Tendencias en tiempo real via Google/YouTube Autocomplete",
    "",
    `Total ideas: ${CONTENT_IDEAS.length}`,
    `Documentos Word: ${totalDocs}`,
    `Miniaturas: ${totalThumbs}`,
    `Errores: ${errors.length}`,
    "",
    "## Competidores Mapeados",
    "",
  ];

  // Lista de competidores
  for (const [cat, comps] of Object.entries(COMPETITORS)) {
    indexLines.push(`### ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
    for (const c of comps) {
      indexLines.push(`- **${c.nombre}** (${c.pais}) — ${c.fuerte}`);
    }
    indexLines.push("");
  }

  // Tendencias actuales
  if (trendData && trendData.top_20) {
    indexLines.push("## Top 20 Tendencias Actuales");
    trendData.top_20.forEach((t, i) => {
      indexLines.push(`${i + 1}. "${t.keyword}" (${t.sources.join("+")} | ${t.verticals.join(", ")})`);
    });
    indexLines.push("");
  }

  indexLines.push("---", "", "## Contenido Generado", "");

  for (let i = 0; i < CONTENT_IDEAS.length; i++) {
    const idea = CONTENT_IDEAS[i];
    const num = String(i + 1).padStart(2, "0");
    indexLines.push(`### ${num}. ${idea.titulo_contenido}`);
    indexLines.push(`- **Plataforma:** ${idea.plataforma} | **Vertical:** ${idea.vertical} | **Prioridad:** ${idea.prioridad}`);
    indexLines.push(`- **Keyword:** ${idea.keyword_principal}`);
    indexLines.push(`- **Competidores:** ${(idea.competitors || []).join(", ")}`);
    indexLines.push(`- **Archivos:** 3 Word + 3 PNG`);
    indexLines.push("");
  }

  if (errors.length > 0) {
    indexLines.push("## Errores");
    errors.forEach((e) => indexLines.push(`- [${e.platform}] ${e.idea}: ${e.error}`));
  }

  fs.writeFileSync(path.join(baseDir, "INDICE_CONTENIDO_V2.md"), indexLines.join("\n"));

  // ---- RESUMEN FINAL ----
  console.log("\n" + "═".repeat(67));
  console.log("  ✅ GENERACIÓN V2 COMPLETADA");
  console.log("═".repeat(67));
  console.log(`  📁 Ubicación:     ${baseDir}`);
  console.log(`  📂 Carpetas:      ${CONTENT_IDEAS.length}`);
  console.log(`  📝 Docs Word:     ${totalDocs}`);
  console.log(`  🎨 Miniaturas:    ${totalThumbs} (con foto + logo + expresiones)`);
  console.log(`  🏢 Competidores:  ${Object.values(COMPETITORS).flat().length} mapeados`);
  console.log(`  📈 Tendencias:    ${trendData ? trendData.all_keywords_ranked.length : 0} keywords en tiempo real`);
  console.log(`  ❌ Errores:       ${errors.length}`);
  console.log("");
  console.log("  Cada carpeta contiene:");
  console.log("  ├── Guion_TikTok_*.docx       (guión + hashtags + miniatura con foto)");
  console.log("  ├── Guion_Instagram_*.docx     (guión + hashtags + miniatura con foto)");
  console.log("  ├── Guion_Facebook_*.docx      (guión + hashtags + miniatura con foto)");
  console.log("  ├── thumbnail_tiktok.png       (1080×1920 con expresión contextual)");
  console.log("  ├── thumbnail_instagram.png    (1080×1080 con expresión contextual)");
  console.log("  └── thumbnail_facebook.png     (1200×630 con expresión contextual)");
  console.log("═".repeat(67));
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
