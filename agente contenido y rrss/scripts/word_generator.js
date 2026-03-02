/**
 * Generador de Documentos Word para Mega Mayorista
 * Crea un .docx por cada idea de contenido con:
 *   - Guión completo adaptado a la plataforma
 *   - Hashtags optimizados
 *   - Prompt detallado para generación de miniatura con IA
 */

const {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, BorderStyle, TableCell,
  TableRow, Table, WidthType, ShadingType, TabStopPosition,
  TabStopType, PageBreak, Header, Footer,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ============================================================================
// MAPA DE EXPRESIONES FACIALES POR TIPO DE CONTENIDO
// ============================================================================
const EXPRESSION_MAP = {
  "Hook viral": { expresion: "sorpresa extrema", descripcion: "boca abierta, ojos muy abiertos, cejas levantadas, como si descubriera algo increíble" },
  "Antes/Después": { expresion: "asombro", descripcion: "expresión de WOW, ojos grandes, sonrisa de sorpresa, señalando el producto" },
  "Showcase": { expresion: "emoción genuina", descripcion: "sonrisa amplia, ojos brillantes, sosteniendo el producto con orgullo" },
  "Storytelling": { expresion: "confianza emprendedora", descripcion: "sonrisa segura, mirada directa a cámara, postura de éxito con los brazos cruzados" },
  "Unboxing": { expresion: "curiosidad emocionada", descripcion: "ojos muy abiertos, manos en la caja, expresión de anticipación y emoción" },
  "Review": { expresion: "análisis serio pero amigable", descripcion: "ceja levantada, mirada analítica, sosteniendo el producto con gesto de evaluación" },
  "Top / Ranking": { expresion: "duda intrigante", descripcion: "dedo en la barbilla, mirada hacia arriba, gesto de '¿cuál será el #1?'" },
  "Comparativa": { expresion: "duda evaluativa", descripcion: "ambas manos extendidas comparando, expresión de '¿cuál es mejor?', cejas fruncidas" },
  "Carousel educativo": { expresion: "profesionalismo amigable", descripcion: "sonrisa confiada, señalando con el dedo, como un experto compartiendo consejos" },
  "Carousel producto": { expresion: "emoción por el producto", descripcion: "sosteniendo el producto cerca del rostro, sonrisa cálida, ojos enfocados en el producto" },
  "Reel": { expresion: "energía dinámica", descripcion: "pose dinámica, sonrisa energética, gesto de invitación a ver el contenido" },
  "Post engagement": { expresion: "invitación amigable", descripcion: "señalando a cámara, sonrisa cómplice, gesto de '¡esto es para ti!'" },
  "Promo": { expresion: "urgencia emocionada", descripcion: "mano señalando oferta, expresión de '¡no te lo pierdas!', ojos abiertos con emoción" },
  "Guía": { expresion: "autoridad experta", descripcion: "mirada directa, sonrisa profesional, brazos abiertos como presentando información" },
  "Listicle": { expresion: "entusiasmo contando", descripcion: "mano mostrando números con los dedos, sonrisa amplia, energía positiva" },
  "Informativo": { expresion: "seriedad accesible", descripcion: "gesto explicativo con las manos, mirada directa, expresión informativa y confiable" },
  "Tutorial": { expresion: "guía paso a paso", descripcion: "señalando hacia abajo como indicando pasos, sonrisa motivadora, gesto didáctico" },
  "FAQ": { expresion: "escucha activa", descripcion: "mano en el oído como escuchando preguntas, expresión empática, gesto de 'yo te resuelvo'" },
};

// ============================================================================
// PALETA DE COLORES POR VERTICAL
// ============================================================================
const VERTICAL_COLORS = {
  "Tecnología": { primario: "azul eléctrico (#0066FF)", secundario: "negro (#000000)", acento: "cian neón (#00E5FF)", fondo: "degradado azul oscuro a negro" },
  "Belleza": { primario: "rosa (#FF4081)", secundario: "dorado (#FFD700)", acento: "lila (#CE93D8)", fondo: "degradado rosa suave a blanco" },
  "Hogar": { primario: "verde esmeralda (#00C853)", secundario: "madera (#8D6E63)", acento: "amarillo cálido (#FFD54F)", fondo: "degradado beige a blanco" },
  "Variedades": { primario: "naranja (#FF6D00)", secundario: "morado (#7C4DFF)", acento: "amarillo (#FFEA00)", fondo: "degradado multicolor vibrante" },
  "General": { primario: "rojo Mega Mayorista (#E53935)", secundario: "blanco (#FFFFFF)", acento: "dorado (#FFC107)", fondo: "degradado rojo a rojo oscuro" },
};

// ============================================================================
// DIMENSIONES POR PLATAFORMA
// ============================================================================
const PLATFORM_SPECS = {
  tiktok: {
    nombre: "TikTok",
    dimensiones: "1080 x 1920 píxeles",
    ratio: "9:16 (vertical/portrait)",
    orientacion: "VERTICAL",
    zona_texto_segura: "Evitar los 150px superiores (barra de estado) y 300px inferiores (botones de interacción)",
    formato_salida: "PNG o JPG alta calidad",
  },
  instagram: {
    nombre: "Instagram",
    dimensiones: "1080 x 1080 píxeles",
    ratio: "1:1 (cuadrado)",
    orientacion: "CUADRADO",
    zona_texto_segura: "Centrar elementos principales, evitar bordes extremos (50px de margen)",
    formato_salida: "PNG o JPG alta calidad",
  },
  facebook: {
    nombre: "Facebook",
    dimensiones: "1200 x 630 píxeles",
    ratio: "1.91:1 (horizontal/landscape)",
    orientacion: "HORIZONTAL",
    zona_texto_segura: "El texto debe ocupar menos del 20% del área total. Centrar elementos clave.",
    formato_salida: "PNG o JPG alta calidad",
  },
};

// ============================================================================
// GENERADOR DE PROMPTS PARA MINIATURAS CON IA
// ============================================================================
function generateThumbnailPrompt(idea, platform, competitors) {
  const platSpec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.instagram;
  const expression = EXPRESSION_MAP[idea.tipo_contenido] || EXPRESSION_MAP["Showcase"];
  const colors = VERTICAL_COLORS[idea.vertical] || VERTICAL_COLORS["General"];
  const comps = competitors || [];

  // Texto principal para la miniatura (corto, impactante)
  const thumbnailTexts = generateThumbnailTexts(idea, comps);

  // Badge de competencia si hay comparaciones
  const competitorBadge = comps.length > 0
    ? `Incluir un badge/sello circular pequeño en una esquina con el texto "${comps[0]}" en rojo con fondo blanco.`
    : "";

  // Elementos por tipo de contenido
  const contentElements = generateContentSpecificElements(idea);

  const prompt = {
    seccion_1_especificaciones: {
      titulo: "ESPECIFICACIONES TÉCNICAS",
      contenido: [
        `Plataforma: ${platSpec.nombre}`,
        `Dimensiones exactas: ${platSpec.dimensiones}`,
        `Relación de aspecto: ${platSpec.ratio}`,
        `Orientación: ${platSpec.orientacion}`,
        `Zona segura de texto: ${platSpec.zona_texto_segura}`,
        `Formato de salida: ${platSpec.formato_salida}`,
        `Resolución: 72 DPI mínimo para web, 300 DPI para impresión`,
      ],
    },
    seccion_2_composicion: {
      titulo: "COMPOSICIÓN Y LAYOUT",
      contenido: [
        `FONDO: ${colors.fondo}`,
        `COLOR PRIMARIO: ${colors.primario}`,
        `COLOR SECUNDARIO: ${colors.secundario}`,
        `COLOR DE ACENTO: ${colors.acento}`,
        ``,
        `DISTRIBUCIÓN DE ELEMENTOS:`,
        ...(platform === "tiktok" ? [
          `• Zona superior (20%): Título principal en texto grande, bold, con sombra`,
          `• Zona central (50%): Persona (presenter) con expresión facial + producto destacado`,
          `• Zona inferior (30%): Subtítulo, badge de competencia, logo Mega Mayorista`,
        ] : platform === "instagram" ? [
          `• Zona izquierda (40%): Persona (presenter) con expresión facial`,
          `• Zona derecha (60%): Título principal + producto + badge de competencia`,
          `• Zona inferior centrada: Logo Mega Mayorista + CTA`,
        ] : [
          `• Zona izquierda (35%): Persona (presenter) con expresión facial`,
          `• Zona central (40%): Título principal grande + subtítulo`,
          `• Zona derecha (25%): Producto destacado + precio/oferta`,
          `• Esquina inferior derecha: Logo Mega Mayorista`,
        ]),
      ],
    },
    seccion_3_persona: {
      titulo: "PERSONA / PRESENTADOR",
      contenido: [
        `Persona: Hombre latino, polo roja con branding "El Mayorista", look profesional pero accesible`,
        `Expresión facial: ${expression.expresion.toUpperCase()}`,
        `Descripción de la expresión: ${expression.descripcion}`,
        `Posición: De la cintura para arriba (medium shot), ligeramente girado hacia el producto`,
        `Fondo detrás de la persona: Recortado (sin fondo) para composición limpia`,
        `Nota: Usar la foto de perfil oficial de Mega Mayorista como referencia para el rostro y vestimenta`,
      ],
    },
    seccion_4_textos: {
      titulo: "TEXTOS EN LA MINIATURA",
      contenido: [
        `TÍTULO PRINCIPAL: "${thumbnailTexts.titulo}"`,
        `• Fuente: Bold/Extra-Bold, Sans-Serif (estilo Impact, Montserrat Black o similar)`,
        `• Tamaño: Grande, ocupa mínimo 30% del ancho`,
        `• Color: Blanco con stroke/borde negro para legibilidad`,
        `• Efecto: Sombra suave o glow del color de acento`,
        ``,
        `SUBTÍTULO: "${thumbnailTexts.subtitulo}"`,
        `• Fuente: Semi-Bold, Sans-Serif`,
        `• Tamaño: 50% del tamaño del título`,
        `• Color: ${colors.acento}`,
        ``,
        ...(thumbnailTexts.precio ? [
          `ELEMENTO DE PRECIO/OFERTA: "${thumbnailTexts.precio}"`,
          `• Dentro de un starburst/explosión amarilla`,
          `• Fuente: Extra-Bold, color rojo`,
          ``,
        ] : []),
        competitorBadge,
      ].filter(Boolean),
    },
    seccion_5_producto: {
      titulo: "PRODUCTO / ELEMENTOS VISUALES",
      contenido: contentElements,
    },
    seccion_6_branding: {
      titulo: "BRANDING MEGA MAYORISTA",
      contenido: [
        `Logo: Óvalo rojo con texto "MEGA MAYORISTA" en blanco`,
        `Slogan debajo: "Impulsando tu éxito cada día"`,
        `Posición del logo: Esquina inferior (derecha para Facebook, centrado inferior para TikTok e Instagram)`,
        `Tamaño del logo: 10-15% del área total de la imagen`,
        `Barra de marca: Franja delgada en la parte inferior con color primario de la vertical`,
      ],
    },
    seccion_7_prompt_ia: {
      titulo: "PROMPT LISTO PARA COPIAR Y PEGAR (IA)",
      contenido: buildCopyPastePrompt(idea, platform, platSpec, expression, colors, thumbnailTexts, comps, contentElements),
    },
  };

  return prompt;
}

// Genera textos cortos e impactantes para la miniatura
function generateThumbnailTexts(idea, competitors) {
  const tipo = idea.tipo_contenido;
  const keyword = idea.keyword_principal;
  const titulo = idea.titulo_contenido;

  const textMap = {
    "Hook viral": { titulo: "😱 ¡ESTO EXISTE!", subtitulo: keyword, precio: null },
    "Antes/Después": { titulo: "ANTES vs DESPUÉS", subtitulo: keyword, precio: null },
    "Showcase": { titulo: "TOP PRODUCTOS", subtitulo: keyword, precio: "DESDE $1 USD" },
    "Storytelling": { titulo: "MI HISTORIA", subtitulo: "De $0 a $5,000/mes", precio: null },
    "Unboxing": { titulo: "📦 UNBOXING", subtitulo: keyword, precio: "AL POR MAYOR" },
    "Review": { titulo: "REVIEW HONESTO", subtitulo: "¿Vale la pena?", precio: null },
    "Top / Ranking": { titulo: "TOP 15 🔥", subtitulo: keyword, precio: "PARA REVENDER" },
    "Comparativa": { titulo: competitors.length > 0 ? competitors.slice(0, 2).join(" vs ").replace(/vs /g, "") : "¿CUÁL ES MEJOR?", subtitulo: "Comparativa completa", precio: null },
    "Carousel educativo": { titulo: "5 RAZONES", subtitulo: keyword, precio: null },
    "Carousel producto": { titulo: "KIT COMPLETO", subtitulo: keyword, precio: "MENOS DE $20" },
    "Reel": { titulo: "✨ TRANSFORMACIÓN", subtitulo: keyword, precio: null },
    "Post engagement": { titulo: "🆕 CATÁLOGO NUEVO", subtitulo: "+500 productos", precio: "PRECIOS DE FÁBRICA" },
    "Promo": { titulo: "🔥 OFERTA FLASH", subtitulo: keyword, precio: "30% OFF MAYOREO" },
    "Guía": { titulo: "GUÍA COMPLETA", subtitulo: keyword, precio: null },
    "Listicle": { titulo: "TOP 10 🏆", subtitulo: keyword, precio: "PARA REVENDER" },
    "Informativo": { titulo: "LO QUE DEBES SABER", subtitulo: keyword, precio: null },
    "Tutorial": { titulo: "CÓMO EMPEZAR", subtitulo: keyword, precio: null },
    "FAQ": { titulo: "PREGUNTAS FRECUENTES", subtitulo: keyword, precio: null },
  };

  return textMap[tipo] || { titulo: titulo.slice(0, 30).toUpperCase(), subtitulo: keyword, precio: null };
}

// Genera elementos visuales específicos según el tipo de contenido
function generateContentSpecificElements(idea) {
  const tipo = idea.tipo_contenido;
  const vertical = idea.vertical;

  const baseProducts = {
    "Tecnología": "gadgets electrónicos (audífonos, smartwatch, LED strips, cargadores)",
    "Belleza": "productos de skincare y maquillaje (sérums, brochas, paletas, esponjas)",
    "Hogar": "utensilios y organizadores de cocina/hogar (gadgets cocina, organizadores, decoración)",
    "Variedades": "productos novedosos y virales (juguetes, regalos originales, productos TikTok)",
    "General": "surtido variado de productos importados (mix de todas las verticales)",
  };

  const productDesc = baseProducts[vertical] || baseProducts["General"];

  const elementsByType = {
    "Hook viral": [
      `Producto central: ${productDesc} — mostrar el más impactante/novedoso`,
      `Efecto visual: Destellos, emojis 3D flotando (🤯😱🔥), flechas apuntando al producto`,
      `Elemento sorpresa: Zoom dramático al producto con efecto de brillo`,
    ],
    "Antes/Después": [
      `Dividir imagen: Mitad izquierda "ANTES" (escena desordenada/sin producto), Mitad derecha "DESPUÉS" (escena mejorada con producto)`,
      `Producto: ${productDesc} — visible en la transición`,
      `Flecha o divisor central brillante separando ambas partes`,
    ],
    "Showcase": [
      `Productos: ${productDesc} — dispuestos en abanico o exhibición atractiva`,
      `Iluminación: Spotlight sobre los productos, fondo difuminado`,
      `Etiquetas de precio flotantes junto a cada producto`,
    ],
    "Storytelling": [
      `Elemento visual: Billetes/monedas en transición (poco → mucho), gráfica de crecimiento`,
      `Cajas de envío de Mega Mayorista apiladas en el fondo`,
      `Efecto aspiracional: El presenter en pose de éxito con productos`,
    ],
    "Unboxing": [
      `Caja de envío abierta con productos ${productDesc} saliendo`,
      `Efecto: Productos "volando" fuera de la caja, destellos y emojis 📦✨`,
      `Logo de Mega Mayorista en la caja`,
    ],
    "Review": [
      `Producto: ${productDesc} — mostrado de cerca con detalles visibles`,
      `Elemento: Escala de calificación (estrellas ⭐ o porcentaje)`,
      `Gesto: Pulgar arriba/abajo o lupa examinando el producto`,
    ],
    "Top / Ranking": [
      `Productos: ${productDesc} — múltiples productos numerados (#1, #2, #3...)`,
      `Podio o estantería con los productos ordenados`,
      `Corona o trofeo sobre el producto #1`,
    ],
    "Comparativa": [
      `Layout: Dividido en 2-3 columnas, cada una con un logo de mayorista`,
      `Tabla visual de comparación (✅ vs ❌) simplificada`,
      `Flechas apuntando al ganador (Mega Mayorista)`,
    ],
    "Carousel educativo": [
      `5 íconos o números grandes (1️⃣2️⃣3️⃣4️⃣5️⃣) visibles`,
      `Producto: ${productDesc} — como ejemplo visual`,
      `Diseño limpio, tipo infografía`,
    ],
    "Carousel producto": [
      `Producto: ${productDesc} — exhibido como si fuera una foto de catálogo premium`,
      `Etiqueta de precio con descuento tachado`,
      `Badge de "Kit completo" o "Set incluido"`,
    ],
    "Reel": [
      `Producto: ${productDesc} — en acción/uso`,
      `Efecto de movimiento/blur para denotar acción`,
      `Ícono de Play ▶️ superpuesto sutilmente`,
    ],
    "Post engagement": [
      `Collage de varios productos: ${productDesc}`,
      `Badge de "NUEVO" o "RECIÉN LLEGADO"`,
      `Elementos interactivos visuales (👇 flechas, emojis de reacción)`,
    ],
    "Promo": [
      `Producto: ${productDesc} — con precio tachado y nuevo precio en grande`,
      `Starburst amarillo con "30% OFF" o similar`,
      `Reloj/temporizador visual indicando urgencia`,
      `Efecto: Destellos rojos y dorados`,
    ],
    "Guía": [
      `Libro o guía visual abierto con el título del contenido`,
      `Producto: ${productDesc} — como ilustración`,
      `Ícono de checklist ✅ o pasos numerados`,
    ],
    "Listicle": [
      `Productos: ${productDesc} — múltiples productos en grid o lista visual`,
      `Números grandes y coloridos junto a cada producto`,
      `Badge de "TRENDING" o "MÁS VENDIDOS"`,
    ],
    "Informativo": [
      `Elemento: Globo terráqueo o mapa China→LATAM con ruta`,
      `Producto: ${productDesc} — como ejemplo ilustrativo`,
      `Ícono de información ℹ️ o lupa`,
    ],
    "Tutorial": [
      `Pasos numerados visualmente (1→2→3)`,
      `Producto: ${productDesc} — en contexto de uso`,
      `Flechas direccionales indicando progreso`,
    ],
    "FAQ": [
      `Signos de interrogación ❓ grandes y coloridos`,
      `Burbuja de chat con pregunta frecuente`,
      `Producto: ${productDesc} — como respuesta visual`,
    ],
  };

  return elementsByType[tipo] || [
    `Producto: ${productDesc}`,
    `Disposición atractiva y profesional`,
    `Elementos visuales acordes al tema "${idea.titulo_contenido}"`,
  ];
}

// Construye el prompt listo para copiar y pegar en herramientas de IA
function buildCopyPastePrompt(idea, platform, platSpec, expression, colors, texts, competitors, contentElements) {
  const compText = competitors.length > 0
    ? `Incluir badge circular pequeño en esquina con "${competitors[0]}".`
    : "";

  const prompt = `Crea una miniatura/thumbnail profesional para ${platSpec.nombre} con las siguientes características:

DIMENSIONES: ${platSpec.dimensiones} (${platSpec.ratio})

COMPOSICIÓN:
- Fondo: ${colors.fondo}
- En ${platform === "tiktok" ? "el centro-izquierda" : platform === "instagram" ? "el lado izquierdo" : "el tercio izquierdo"}: Un hombre latino con polo roja (marca "El Mayorista"), expresión de ${expression.expresion} (${expression.descripcion})
- Texto principal grande: "${texts.titulo}" en fuente bold blanca con borde negro
- Subtítulo: "${texts.subtitulo}" en color ${colors.acento}
${texts.precio ? `- Elemento de precio: "${texts.precio}" dentro de un starburst amarillo` : ""}
${compText}
- Logo de Mega Mayorista (óvalo rojo con texto blanco) en la esquina inferior

ELEMENTOS VISUALES:
${contentElements.map(e => `- ${e}`).join("\n")}

ESTILO:
- Colores dominantes: ${colors.primario}, ${colors.secundario}, ${colors.acento}
- Alta saturación y contraste para destacar en el feed
- Texto legible incluso en tamaño pequeño (mobile)
- Aspecto profesional pero llamativo y viral
- Sin texto que ocupe más del 20% del área total

MARCA: Logo de "MEGA MAYORISTA" (óvalo rojo, texto blanco, slogan "Impulsando tu éxito cada día")`;

  return [prompt];
}


// ============================================================================
// GENERACIÓN DE GUIONES POR PLATAFORMA
// ============================================================================

function generateTikTokScript(idea) {
  return {
    hook: {
      duracion: "0:00 - 0:03",
      instruccion: "HOOK — Detener el scroll",
      texto_pantalla: `"¿Ya conoces esto?" o "POV: descubriste que esto existe 🤯"`,
      accion: `[Mostrar el producto de cerca con zoom rápido. Texto en pantalla grande y llamativo. Expresión facial de sorpresa.]`,
      nota_produccion: `Usar transición rápida o jump cut. El primer frame debe ser impactante visualmente.`,
    },
    cuerpo: [
      {
        duracion: "0:03 - 0:08",
        instruccion: "PROBLEMA / NECESIDAD",
        texto_pantalla: `"¿Te ha pasado que...?" o "El problema que todos tenemos"`,
        accion: `[Mostrar situación cotidiana donde se necesita el producto. Usar texto overlay explicativo.]`,
      },
      {
        duracion: "0:08 - 0:20",
        instruccion: "DEMOSTRACIÓN DEL PRODUCTO",
        texto_pantalla: `"Mira cómo funciona 👇"`,
        accion: `[Demo en acción del producto. Close-ups. Mostrar el momento "wow". Antes/Después si aplica.]`,
        nota_produccion: `Esta es la parte más importante. El producto debe verse increíble.`,
      },
      {
        duracion: "0:20 - 0:30",
        instruccion: "BENEFICIOS CLAVE",
        texto_pantalla: `"✅ Beneficio 1 ✅ Beneficio 2 ✅ Beneficio 3"`,
        accion: `[Mostrar 2-3 beneficios con texto overlay. Cada beneficio = 3 segundos max.]`,
      },
      {
        duracion: "0:30 - 0:40",
        instruccion: "PRECIO / ACCESIBILIDAD",
        texto_pantalla: `"Y lo mejor... ¡el precio! 💰"`,
        accion: `[Revelar rango de precio. Mencionar "precios de mayoreo". Mostrar comparación de valor.]`,
      },
    ],
    cta: {
      duracion: "0:40 - 0:45",
      instruccion: "CTA — Llamada a la acción",
      texto_pantalla: `"🔗 Link en bio | Sígueme para más"`,
      accion: `[Señalar la bio. Texto grande con CTA. Mantener el producto en pantalla.]`,
    },
    metadata: {
      duracion_total: "15-45 segundos",
      formato: idea.tipo_contenido,
      sonido_sugerido: "Trending sound (verificar tendencias actuales)",
      velocidad: "Cortes rápidos, 1.2x en demos si es necesario",
    },
  };
}

function generateInstagramScript(idea) {
  return {
    caption: {
      primera_linea: `✨ ${idea.titulo_contenido.replace(/[📸🎵▶️🔍📦]/g, "").trim()}`,
      cuerpo: [
        `¿Sabías que puedes conseguir los mejores productos importados a precios increíbles? 🛍️`,
        ``,
        `En Mega Mayorista tenemos TODO lo que necesitas:`,
        `▪️ Precios de fábrica directos de China`,
        `▪️ Venta al por mayor Y al detal`,
        `▪️ Envío a toda Latinoamérica`,
        `▪️ Productos trending que se venden solos`,
        ``,
        `🔥 Lo que más nos piden esta semana:`,
        `→ ${idea.keyword_principal}`,
        `→ Productos virales de TikTok`,
        `→ Gadgets útiles y baratos`,
        ``,
        `💡 ¿Quieres empezar tu propio negocio de reventa?`,
        `Escríbenos y te armamos un paquete personalizado.`,
        ``,
        `📲 Link en bio para ver el catálogo completo`,
        `💬 Comenta "QUIERO" para más info`,
      ],
    },
    carousel: idea.tipo_contenido.toLowerCase().includes("carousel")
      ? {
          slide_1: `[PORTADA] Título llamativo: "${idea.titulo_contenido}" + Logo Mega Mayorista`,
          slide_2: `[CONTEXTO] ¿Por qué este tema importa? Dato impactante o estadística`,
          slide_3: `[PUNTO 1] Primer beneficio/tip con visual atractivo`,
          slide_4: `[PUNTO 2] Segundo beneficio/tip con ejemplo real`,
          slide_5: `[PUNTO 3] Tercer beneficio/tip con datos de precio`,
          slide_6: `[PUNTO 4] Cuarto beneficio/tip con comparación`,
          slide_7: `[PUNTO 5] Quinto beneficio/tip con testimonial`,
          slide_8: `[RESUMEN] Recapitulación visual de los 5 puntos`,
          slide_9: `[CTA] "¿Listo para empezar? 📲 Link en bio" + Logo`,
          slide_10: `[BONUS] Oferta especial o código de descuento`,
        }
      : null,
    reel: idea.tipo_contenido.toLowerCase().includes("reel")
      ? {
          segundo_0_1: `[HOOK] Texto grande en pantalla. Expresión de sorpresa.`,
          segundo_1_5: `[PROBLEMA] Situación relatable con texto overlay`,
          segundo_5_15: `[SOLUCIÓN] Demo del producto. Close-ups. Momento wow.`,
          segundo_15_25: `[BENEFICIOS] 3 puntos clave con texto animado`,
          segundo_25_30: `[CTA] "Link en bio 🔗" + Señalar. Logo.`,
        }
      : null,
  };
}

function generateFacebookScript(idea) {
  return {
    gancho_inicial: `¡No vas a creer lo que acaba de llegar! 😱`,
    cuerpo: [
      `¿Alguna vez quisiste tener acceso a los mejores productos importados SIN pagar de más? 🤔`,
      ``,
      `Te cuento algo... nosotros en Mega Mayorista llevamos años importando directamente de fábrica, y eso significa UNA cosa para ti: PRECIOS INCREÍBLES 💰`,
      ``,
      `${idea.titulo_contenido}`,
      ``,
      `🔥 ¿Qué hace diferente a Mega Mayorista?`,
      ``,
      `1️⃣ Precios de fábrica — Sin intermediarios, directo de China a ti`,
      `2️⃣ Mayoreo Y menudeo — Ya sea que compres 1 o 100, tenemos precio para ti`,
      `3️⃣ Productos TRENDING — Todo lo que ves en TikTok, lo tenemos primero`,
      `4️⃣ Envío a todo LATAM — No importa dónde estés`,
      `5️⃣ Catálogo actualizado cada semana con novedades`,
      ``,
      `👉 Y lo mejor: tenemos una sección especial de "${idea.keyword_principal}" que está VOLANDO de lo rápido que se vende.`,
      ``,
      `💬 Comenta "INFO" y te enviamos el catálogo completo por mensaje privado`,
      `📲 O visita nuestro link para ver todos los productos disponibles`,
      ``,
      `PD: Si tienes una tienda o vendes por redes sociales, tenemos precios especiales de mayoreo que te van a encantar. ¡Pregúntanos! 🙌`,
    ],
    engagement_hooks: [
      `¿Cuál de estos productos necesitas YA? Comenta 👇`,
      `Etiqueta a tu amig@ que siempre busca ofertas 😏`,
      `¿Ya nos sigues? Subimos productos nuevos cada semana 🔔`,
    ],
  };
}

// ============================================================================
// GENERACIÓN DE HASHTAGS
// ============================================================================

function generateHashtags(idea, platform) {
  const base = {
    marca: ["#MegaMayorista", "#MegaMayoristaOficial"],
    generales_altoVolumen: [
      "#ProductosImportados", "#Gadgets", "#Tecnologia",
      "#Belleza", "#Hogar", "#Shopping", "#Ofertas",
      "#Tendencia", "#Viral", "#Novedades",
    ],
    medianos: [
      "#GadgetsBaratos", "#ProductosNovedosos", "#ComprasInteligentes",
      "#ImportadosDeChina", "#MayoreoYMenudeo", "#PreciosDeFabrica",
      "#ProductosTrending", "#NegocioRentable", "#Emprendimiento",
      "#ReventaRentable",
    ],
    nicho: [
      "#MayoristaLATAM", "#GadgetsMX", "#ProductosVirales2025",
      "#TiendaOnlineLATAM", "#ImportadorDirecto", "#PrecioMayoreo",
      "#NegocioDesde Casa", "#VenderPorInternet", "#CatalogoMayorista",
      "#ProductosChinaOriginales",
    ],
    competencia: ["#MejorQueGG", "#AlternativaGG"],
  };

  // Keywords específicas de la idea
  const ideaHashtags = idea.keyword_principal
    .split(" ")
    .filter((w) => w.length > 3)
    .map((w) => `#${w.charAt(0).toUpperCase() + w.slice(1)}`)
    .slice(0, 3);

  const verticalHashtags = {
    Tecnología: ["#TechBarato", "#GadgetsUtiles", "#AccesoriosTech", "#SmartGadgets"],
    Belleza: ["#SkincareBarato", "#MaquillajeImportado", "#KBeauty", "#RutinaDeBelleza"],
    Hogar: ["#CasaOrganizada", "#DecoHogar", "#CocinaNovedosa", "#OrganizaTuVida"],
    Variedades: ["#JuguetesVirales", "#RegalosOriginales", "#ProductosFun", "#VariedadesOnline"],
    General: ["#LoMejorDeChina", "#ProductosQueAmas", "#DescubrimientosOnline", "#MustHave"],
  };

  const vTags = verticalHashtags[idea.vertical] || verticalHashtags.General;

  if (platform === "tiktok") {
    // TikTok: máximo 10 hashtags
    return [
      ...base.marca.slice(0, 1),
      ...base.generales_altoVolumen.slice(0, 3),
      ...base.medianos.slice(0, 2),
      ...ideaHashtags.slice(0, 2),
      ...vTags.slice(0, 2),
    ].slice(0, 10);
  }

  if (platform === "instagram") {
    // Instagram: exactamente 30 hashtags
    return [
      ...base.marca,
      ...base.generales_altoVolumen,
      ...base.medianos,
      ...base.nicho.slice(0, 5),
      ...ideaHashtags,
      ...vTags,
      ...base.competencia.slice(0, 1),
    ].slice(0, 30);
  }

  if (platform === "facebook") {
    // Facebook: máximo 5 hashtags
    return [
      ...base.marca.slice(0, 1),
      ...base.generales_altoVolumen.slice(0, 2),
      ...ideaHashtags.slice(0, 1),
      ...vTags.slice(0, 1),
    ].slice(0, 5);
  }

  return base.marca;
}

// ============================================================================
// CONSTRUCCIÓN DEL DOCUMENTO WORD
// ============================================================================

function createWordDocument(idea, script, hashtags, thumbnailPath, platform, competitors) {
  const platformColors = {
    tiktok: "E91E63",
    instagram: "8E24AA",
    facebook: "1565C0",
  };
  const accentColor = platformColors[platform] || "F97316";
  const platformNames = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
  const platName = platformNames[platform] || platform;

  const sections = [];

  // ---- PORTADA ----
  const coverChildren = [
    new Paragraph({ spacing: { after: 600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "MEGA MAYORISTA",
          bold: true,
          size: 52,
          color: accentColor,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "mayorista • minorista • importados",
          size: 20,
          color: "888888",
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          color: accentColor,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `GUIÓN DE CONTENIDO — ${platName.toUpperCase()}`,
          bold: true,
          size: 28,
          color: "333333",
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `"${idea.titulo_contenido}"`,
          bold: true,
          size: 36,
          color: "111111",
          font: "Calibri",
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Vertical: ${idea.vertical} | Tipo: ${idea.tipo_contenido} | Prioridad: ${idea.prioridad}`,
          size: 18,
          color: "666666",
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `Keyword Principal: ${idea.keyword_principal}`,
          size: 20,
          color: accentColor,
          bold: true,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Fecha de generación: ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`,
          size: 16,
          color: "999999",
          font: "Calibri",
        }),
      ],
    }),
  ];

  // ---- SECCIÓN 1: GUIÓN ----
  const scriptChildren = [
    createSectionHeader("1. GUIÓN COMPLETO", accentColor),
    new Paragraph({ spacing: { after: 200 } }),
  ];

  if (platform === "tiktok") {
    // HOOK (flexible field names: instruccion/seccion/nombre, nota_produccion/nota)
    const hookLabel = script.hook.instruccion || script.hook.seccion || script.hook.nombre || "HOOK";
    const hookNota = script.hook.nota_produccion || script.hook.nota || "";
    scriptChildren.push(createSubHeader(`⏱ ${script.hook.duracion} — ${hookLabel}`, accentColor));
    scriptChildren.push(createBodyParagraph(`📱 Texto en pantalla: ${script.hook.texto_pantalla}`));
    scriptChildren.push(createBodyParagraph(`🎬 Acción: ${script.hook.accion}`));
    if (hookNota) scriptChildren.push(createBodyParagraph(`📝 Nota: ${hookNota}`, true));
    scriptChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // CUERPO (flexible field names for section label)
    for (const section of script.cuerpo) {
      const sectionLabel = section.instruccion || section.seccion || section.nombre || "ESCENA";
      const sectionNota = section.nota_produccion || section.nota || "";
      scriptChildren.push(createSubHeader(`⏱ ${section.duracion} — ${sectionLabel}`, accentColor));
      scriptChildren.push(createBodyParagraph(`📱 Texto en pantalla: ${section.texto_pantalla}`));
      scriptChildren.push(createBodyParagraph(`🎬 Acción: ${section.accion}`));
      if (sectionNota) {
        scriptChildren.push(createBodyParagraph(`📝 Nota: ${sectionNota}`, true));
      }
      scriptChildren.push(new Paragraph({ spacing: { after: 150 } }));
    }

    // CTA (flexible field names)
    const ctaLabel = script.cta.instruccion || script.cta.seccion || script.cta.nombre || "CTA";
    scriptChildren.push(createSubHeader(`⏱ ${script.cta.duracion} — ${ctaLabel}`, accentColor));
    scriptChildren.push(createBodyParagraph(`📱 Texto: ${script.cta.texto_pantalla}`));
    scriptChildren.push(createBodyParagraph(`🎬 Acción: ${script.cta.accion}`));
    scriptChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // METADATA (flexible field names: formato/estilo, velocidad optional)
    scriptChildren.push(createSubHeader("📊 METADATOS DE PRODUCCIÓN", accentColor));
    scriptChildren.push(createBodyParagraph(`Duración total: ${script.metadata.duracion_total}`));
    scriptChildren.push(createBodyParagraph(`Formato/Estilo: ${script.metadata.formato || script.metadata.estilo || "Video corto"}`));
    scriptChildren.push(createBodyParagraph(`Sonido: ${script.metadata.sonido_sugerido}`));
    if (script.metadata.velocidad) scriptChildren.push(createBodyParagraph(`Velocidad: ${script.metadata.velocidad}`));
  }

  if (platform === "instagram") {
    scriptChildren.push(createSubHeader("📝 CAPTION", accentColor));
    scriptChildren.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: script.caption.primera_linea,
            bold: true,
            size: 24,
            font: "Calibri",
          }),
        ],
      })
    );
    for (const line of script.caption.cuerpo) {
      scriptChildren.push(createBodyParagraph(line || " "));
    }

    if (script.carousel) {
      scriptChildren.push(new Paragraph({ spacing: { after: 300 } }));
      scriptChildren.push(createSubHeader("📱 GUÍA DE CAROUSEL (10 slides)", accentColor));
      for (const [key, val] of Object.entries(script.carousel)) {
        const slideNum = key.replace("slide_", "Slide ");
        scriptChildren.push(createBodyParagraph(`${slideNum}: ${val}`));
      }
    }

    if (script.reel) {
      scriptChildren.push(new Paragraph({ spacing: { after: 300 } }));
      scriptChildren.push(createSubHeader("🎬 GUÍA DE REEL", accentColor));
      for (const [key, val] of Object.entries(script.reel)) {
        const timeLabel = key.replace("segundo_", "Seg ").replace(/_/g, "-");
        scriptChildren.push(createBodyParagraph(`${timeLabel}: ${val}`));
      }
    }

    // New AI format: visual field with formato, descripcion, slides_o_escenas
    if (script.visual) {
      scriptChildren.push(new Paragraph({ spacing: { after: 300 } }));
      const vizFormat = script.visual.formato || "Visual";
      scriptChildren.push(createSubHeader(`🎨 GUÍA VISUAL — ${vizFormat}`, accentColor));
      if (script.visual.descripcion) {
        scriptChildren.push(createBodyParagraph(script.visual.descripcion));
        scriptChildren.push(new Paragraph({ spacing: { after: 100 } }));
      }
      if (Array.isArray(script.visual.slides_o_escenas)) {
        for (let vi = 0; vi < script.visual.slides_o_escenas.length; vi++) {
          scriptChildren.push(createBodyParagraph(`${vi + 1}. ${script.visual.slides_o_escenas[vi]}`));
        }
      }
    }

    // Engagement hooks for Instagram (new AI format)
    if (script.engagement_hooks) {
      scriptChildren.push(new Paragraph({ spacing: { after: 300 } }));
      scriptChildren.push(createSubHeader("💬 HOOKS DE ENGAGEMENT", accentColor));
      const igHooks = Array.isArray(script.engagement_hooks) ? script.engagement_hooks
        : typeof script.engagement_hooks === 'string' ? [script.engagement_hooks]
        : [];
      for (const hook of igHooks) {
        scriptChildren.push(createBodyParagraph(`• ${hook}`));
      }
    }
  }

  if (platform === "facebook") {
    scriptChildren.push(createSubHeader("🎣 GANCHO INICIAL (primera línea visible)", accentColor));
    scriptChildren.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: script.gancho_inicial || "(gancho)",
            bold: true,
            size: 26,
            font: "Calibri",
            color: "E65100",
          }),
        ],
      })
    );

    scriptChildren.push(createSubHeader("📝 CUERPO DEL POST", accentColor));
    const cuerpo = Array.isArray(script.cuerpo) ? script.cuerpo
      : typeof script.cuerpo === 'string' ? script.cuerpo.split('\n')
      : ["(contenido del post)"];
    for (const line of cuerpo) {
      scriptChildren.push(createBodyParagraph(line || " "));
    }

    scriptChildren.push(new Paragraph({ spacing: { after: 300 } }));
    scriptChildren.push(createSubHeader("💬 HOOKS DE ENGAGEMENT", accentColor));
    const hooks = Array.isArray(script.engagement_hooks) ? script.engagement_hooks
      : typeof script.engagement_hooks === 'string' ? [script.engagement_hooks]
      : ["¿Qué opinas? Comenta 👇", "Etiqueta a quien necesite esto 😏", "Síguenos para más ofertas 🔔"];
    for (const hook of hooks) {
      scriptChildren.push(createBodyParagraph(`• ${hook}`));
    }

    // New AI format: imagen_sugerida + mejor_horario
    if (script.imagen_sugerida) {
      scriptChildren.push(new Paragraph({ spacing: { after: 200 } }));
      scriptChildren.push(createSubHeader("🖼️ IMAGEN SUGERIDA", accentColor));
      scriptChildren.push(createBodyParagraph(script.imagen_sugerida));
    }
    if (script.mejor_horario) {
      scriptChildren.push(new Paragraph({ spacing: { after: 100 } }));
      scriptChildren.push(createBodyParagraph(`⏰ Mejor horario para publicar: ${script.mejor_horario}`));
    }
  }

  // ---- SECCIÓN 2: HASHTAGS ----
  const hashtagChildren = [
    new Paragraph({ spacing: { after: 400 } }),
    createSectionHeader("2. HASHTAGS", accentColor),
    new Paragraph({ spacing: { after: 200 } }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `Plataforma: ${platName} | Total: ${hashtags.length} hashtags`,
          size: 20,
          color: "666666",
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 200 } }),
    new Paragraph({
      spacing: { after: 100 },
      shading: { type: ShadingType.SOLID, color: "F5F5F5" },
      children: [
        new TextRun({
          text: "📋 COPIAR Y PEGAR:",
          bold: true,
          size: 20,
          color: "333333",
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      shading: { type: ShadingType.SOLID, color: "FAFAFA" },
      children: [
        new TextRun({
          text: hashtags.join(" "),
          size: 20,
          color: accentColor,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 100 } }),
    createSubHeader("Desglose de hashtags:", accentColor),
  ];

  hashtags.forEach((tag, i) => {
    hashtagChildren.push(
      new Paragraph({
        spacing: { after: 50 },
        children: [
          new TextRun({
            text: `  ${i + 1}. `,
            size: 18,
            color: "888888",
            font: "Calibri",
          }),
          new TextRun({
            text: tag,
            size: 20,
            color: accentColor,
            bold: true,
            font: "Calibri",
          }),
        ],
      })
    );
  });

  // ---- SECCIÓN 3: PROMPT PARA MINIATURA ----
  const thumbnailPromptData = generateThumbnailPrompt(idea, platform, competitors || []);

  const thumbnailChildren = [
    new Paragraph({ spacing: { after: 400 } }),
    createSectionHeader("3. PROMPT PARA GENERAR MINIATURA (IA)", accentColor),
    new Paragraph({ spacing: { after: 100 } }),
    new Paragraph({
      spacing: { after: 200 },
      shading: { type: ShadingType.SOLID, color: "FFF3E0" },
      children: [
        new TextRun({
          text: "💡 Usa este prompt en herramientas de IA como: DALL-E, Midjourney, Leonardo AI, Canva AI, Ideogram, etc.",
          size: 20,
          bold: true,
          color: "E65100",
          font: "Calibri",
        }),
      ],
    }),
  ];

  // Renderizar cada sección del prompt
  const promptSections = [
    thumbnailPromptData.seccion_1_especificaciones,
    thumbnailPromptData.seccion_2_composicion,
    thumbnailPromptData.seccion_3_persona,
    thumbnailPromptData.seccion_4_textos,
    thumbnailPromptData.seccion_5_producto,
    thumbnailPromptData.seccion_6_branding,
  ];

  for (const section of promptSections) {
    thumbnailChildren.push(new Paragraph({ spacing: { after: 150 } }));
    thumbnailChildren.push(createSubHeader(`📌 ${section.titulo}`, accentColor));
    for (const line of section.contenido) {
      if (line === "") {
        thumbnailChildren.push(new Paragraph({ spacing: { after: 50 } }));
      } else {
        thumbnailChildren.push(createBodyParagraph(line));
      }
    }
  }

  // Sección especial: PROMPT LISTO PARA COPIAR Y PEGAR
  thumbnailChildren.push(new Paragraph({ spacing: { after: 300 } }));
  thumbnailChildren.push(
    new Paragraph({
      spacing: { after: 50 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
        left: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
        right: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
      },
      shading: { type: ShadingType.SOLID, color: "F5F5F5" },
      children: [
        new TextRun({
          text: "🎨 PROMPT LISTO PARA COPIAR Y PEGAR EN IA GENERATIVA:",
          bold: true,
          size: 24,
          color: accentColor,
          font: "Calibri",
        }),
      ],
    })
  );
  thumbnailChildren.push(new Paragraph({ spacing: { after: 100 } }));

  const copyPastePrompt = thumbnailPromptData.seccion_7_prompt_ia.contenido[0];
  // Dividir el prompt largo en párrafos para mejor legibilidad
  const promptLines = copyPastePrompt.split("\n");
  for (const line of promptLines) {
    thumbnailChildren.push(
      new Paragraph({
        spacing: { after: 40 },
        shading: { type: ShadingType.SOLID, color: "FAFAFA" },
        children: [
          new TextRun({
            text: line || " ",
            size: 19,
            color: "333333",
            font: "Consolas",
          }),
        ],
      })
    );
  }

  // ---- ENSAMBLAR DOCUMENTO ----
  const doc = new Document({
    creator: "Mega Mayorista — Agente de Contenido",
    title: `${platName} — ${idea.titulo_contenido}`,
    description: `Guión de contenido para ${platName}: ${idea.titulo_contenido}`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "MEGA MAYORISTA — Contenido RRSS",
                    size: 14,
                    color: "BBBBBB",
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${platName} | ${idea.vertical} | Generado automáticamente`,
                    size: 14,
                    color: "BBBBBB",
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...coverChildren,
          new Paragraph({
            children: [new PageBreak()],
          }),
          ...scriptChildren,
          ...hashtagChildren,
          new Paragraph({
            children: [new PageBreak()],
          }),
          ...thumbnailChildren,
        ],
      },
    ],
  });

  return doc;
}

// ============================================================================
// HELPERS DE FORMATO WORD
// ============================================================================

function createSectionHeader(text, color) {
  return new Paragraph({
    spacing: { after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: color },
    },
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: 32,
        color: color,
        font: "Calibri",
      }),
    ],
  });
}

function createSubHeader(text, color) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: 24,
        color: "333333",
        font: "Calibri",
      }),
    ],
  });
}

function createBodyParagraph(text, isNote = false) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: text,
        size: 20,
        color: isNote ? "888888" : "444444",
        italics: isNote,
        font: "Calibri",
      }),
    ],
  });
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  createWordDocument,
  generateTikTokScript,
  generateInstagramScript,
  generateFacebookScript,
  generateHashtags,
  generateThumbnailPrompt,
  Packer,
};
