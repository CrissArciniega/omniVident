/**
 * Generador de Miniaturas V2 — Mega Mayorista
 * Miniaturas creativas con:
 *   - Foto de perfil del presentador con expresiones contextuales
 *   - Logo real de Mega Mayorista
 *   - Diseño adaptado al tono del contenido
 *   - Emojis y elementos visuales según la emoción
 *
 * Plataformas:
 *   - TikTok:    1080x1920 (9:16)
 *   - Instagram:  1080x1080 (1:1)
 *   - Facebook:   1200x630  (1.91:1)
 */

const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

// ============================================================================
// RUTAS DE ASSETS
// ============================================================================
const ASSETS_DIR = path.join(__dirname, "..", "assets");
const LOGO_PATH = path.join(ASSETS_DIR, "logo_mega_mayorista.png");
const PROFILE_PATH = path.join(ASSETS_DIR, "foto_perfil.png");

// ============================================================================
// PALETAS DE COLOR POR CATEGORÍA
// ============================================================================
const COLOR_PALETTES = {
  tecnologia: {
    bg: "#0A0E27", bgAlt: "#1A1A2E", accent: "#00D4FF", accentAlt: "#7B2FFF",
    text: "#FFFFFF", textSub: "#B0C4DE", gradient: ["#0A0E27", "#1A1A2E", "#0D1B3E"],
    emoji: "🔌",
  },
  belleza: {
    bg: "#2D0A1F", bgAlt: "#FFF0F5", accent: "#FF1493", accentAlt: "#FF69B4",
    text: "#FFFFFF", textSub: "#FFD1E8", gradient: ["#2D0A1F", "#4A1942", "#6B2352"],
    emoji: "✨",
  },
  hogar: {
    bg: "#1A1410", bgAlt: "#F5F5DC", accent: "#D4A574", accentAlt: "#8B4513",
    text: "#FFFFFF", textSub: "#DBC9A8", gradient: ["#1A1410", "#2D2015", "#3D2B1A"],
    emoji: "🏠",
  },
  variedades: {
    bg: "#0D0D2B", bgAlt: "#EFF6FF", accent: "#FF6B2B", accentAlt: "#FFD700",
    text: "#FFFFFF", textSub: "#C8D8FF", gradient: ["#0D0D2B", "#1A1A4E", "#2B1B5E"],
    emoji: "🎉",
  },
  general: {
    bg: "#0F172A", bgAlt: "#1E293B", accent: "#F97316", accentAlt: "#06B6D4",
    text: "#FFFFFF", textSub: "#94A3B8", gradient: ["#0F172A", "#1E293B", "#334155"],
    emoji: "🔥",
  },
};

// ============================================================================
// DIMENSIONES POR PLATAFORMA
// ============================================================================
const PLATFORM_SPECS = {
  tiktok: { width: 1080, height: 1920, label: "TikTok" },
  instagram: { width: 1080, height: 1080, label: "Instagram" },
  instagram_reel: { width: 1080, height: 1920, label: "Instagram Reel" },
  facebook: { width: 1200, height: 630, label: "Facebook" },
};

// ============================================================================
// EXPRESIONES FACIALES — Mapeo de contenido a emoción
// Esto controla el overlay visual sobre la foto del presentador
// ============================================================================
const FACIAL_EXPRESSIONS = {
  sorpresa: {
    emoji: "😱",
    overlay_color: "rgba(255, 200, 0, 0.15)",
    border_color: "#FFD700",
    text_bubbles: ["¿QUÉ?!", "WOW!", "NO LO CREO!"],
    glow_color: "#FFD700",
  },
  emocion: {
    emoji: "🤩",
    overlay_color: "rgba(255, 100, 0, 0.12)",
    border_color: "#FF6B2B",
    text_bubbles: ["¡INCREÍBLE!", "MIRA ESTO!", "LO MEJOR!"],
    glow_color: "#FF6B2B",
  },
  duda: {
    emoji: "🤔",
    overlay_color: "rgba(100, 100, 255, 0.12)",
    border_color: "#6366F1",
    text_bubbles: ["¿VALE LA PENA?", "¿CUÁL ELEGIR?", "HMMMM..."],
    glow_color: "#6366F1",
  },
  confianza: {
    emoji: "😎",
    overlay_color: "rgba(0, 200, 100, 0.10)",
    border_color: "#10B981",
    text_bubbles: ["PROBADO ✓", "GARANTIZADO", "EL MEJOR!"],
    glow_color: "#10B981",
  },
  urgencia: {
    emoji: "🚨",
    overlay_color: "rgba(255, 0, 0, 0.15)",
    border_color: "#EF4444",
    text_bubbles: ["¡OFERTA!", "¡SOLO HOY!", "¡CORRE!"],
    glow_color: "#EF4444",
  },
  dinero: {
    emoji: "💰",
    overlay_color: "rgba(0, 200, 0, 0.12)",
    border_color: "#22C55E",
    text_bubbles: ["¡NEGOCIO!", "$$$", "GANANCIA!"],
    glow_color: "#22C55E",
  },
};

// Mapeo de tipo de contenido a expresión facial
function getExpressionForContent(tipoContenido, titulo) {
  const t = (tipoContenido + " " + titulo).toLowerCase();

  if (t.includes("oferta") || t.includes("flash") || t.includes("descuento"))
    return "urgencia";
  if (t.includes("vs") || t.includes("comparativ") || t.includes("review") || t.includes("valen la pena"))
    return "duda";
  if (t.includes("negocio") || t.includes("revend") || t.includes("ganancia") || t.includes("$") || t.includes("mayoreo"))
    return "dinero";
  if (t.includes("pov") || t.includes("descubr") || t.includes("no sabías") || t.includes("unboxing"))
    return "sorpresa";
  if (t.includes("testimonio") || t.includes("faq") || t.includes("guía") || t.includes("razones"))
    return "confianza";
  return "emocion";
}

// ============================================================================
// FUNCIONES DE DIBUJO
// ============================================================================

function drawGradientBackground(ctx, w, h, colors) {
  const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Pattern de puntos sutil
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = "#FFFFFF";
  for (let x = 0; x < w; x += 30) {
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;
}

function drawDecoShapes(ctx, w, h, palette) {
  // Formas abstractas de fondo
  ctx.globalAlpha = 0.06;
  // Triángulos grandes
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.7);
  ctx.lineTo(w * 0.4, h);
  ctx.lineTo(0, h);
  ctx.fill();

  ctx.fillStyle = palette.accentAlt;
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w * 0.6, h * 0.3);
  ctx.lineTo(w, h * 0.3);
  ctx.fill();

  // Círculos bokeh
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 20 + Math.random() * 80;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? palette.accent : palette.accentAlt;
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawProfilePhoto(ctx, profileImg, x, y, size, expression, palette) {
  const expr = FACIAL_EXPRESSIONS[expression];

  ctx.save();

  // Glow exterior
  ctx.shadowColor = expr.glow_color;
  ctx.shadowBlur = 30;

  // Borde de color según expresión
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = expr.border_color;
  ctx.fill();

  ctx.shadowBlur = 0;

  // Recorte circular de la foto
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  // Dibujar la foto de perfil escalada para llenar el círculo
  const aspect = profileImg.width / profileImg.height;
  let drawW, drawH, drawX, drawY;
  if (aspect > 1) {
    drawH = size;
    drawW = size * aspect;
    drawX = x - (drawW - size) / 2;
    drawY = y;
  } else {
    drawW = size;
    drawH = size / aspect;
    drawX = x;
    drawY = y - (drawH - size) / 2;
  }
  ctx.drawImage(profileImg, drawX, drawY, drawW, drawH);

  // Overlay de tono según expresión
  ctx.fillStyle = expr.overlay_color;
  ctx.fillRect(x - size, y - size, size * 3, size * 3);

  ctx.restore();

  // Emoji de expresión (esquina superior derecha de la foto)
  ctx.font = `${Math.round(size * 0.3)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(expr.emoji, x + size - 5, y + 10);

  // Burbuja de texto reacción
  const bubble = expr.text_bubbles[Math.floor(Math.random() * expr.text_bubbles.length)];
  const bubbleFontSize = Math.round(size * 0.14);
  ctx.font = `bold ${bubbleFontSize}px Arial, sans-serif`;
  const bubbleW = ctx.measureText(bubble).width + 20;
  const bubbleH = bubbleFontSize + 14;
  const bx = x + size * 0.7;
  const by = y - bubbleH - 5;

  // Fondo de burbuja
  ctx.fillStyle = expr.border_color;
  ctx.beginPath();
  ctx.roundRect(bx - bubbleW / 2, by, bubbleW, bubbleH, bubbleH / 2);
  ctx.fill();

  // Triángulo de burbuja
  ctx.beginPath();
  ctx.moveTo(bx - 8, by + bubbleH);
  ctx.lineTo(bx + 8, by + bubbleH);
  ctx.lineTo(bx - 5, by + bubbleH + 10);
  ctx.fill();

  // Texto de burbuja
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(bubble, bx, by + bubbleH / 2);
}

function drawRealLogo(ctx, logoImg, x, y, maxW, maxH) {
  const aspect = logoImg.width / logoImg.height;
  let drawW = maxW;
  let drawH = maxW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = maxH * aspect;
  }
  ctx.drawImage(logoImg, x, y, drawW, drawH);
  return { w: drawW, h: drawH };
}

function drawMainTitle(ctx, title, x, y, maxW, palette, fontSize) {
  ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
  let lines = wrapText(ctx, title.toUpperCase(), maxW);

  while (lines.length > 4 && fontSize > 24) {
    fontSize -= 3;
    ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    lines = wrapText(ctx, title.toUpperCase(), maxW);
  }

  const lineHeight = fontSize * 1.2;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * lineHeight;

    // Fondo semi-transparente detrás del texto
    const tw = ctx.measureText(lines[i]).width;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(x - 8, ly - 4, tw + 16, lineHeight + 2, 6);
    ctx.fill();

    // Sombra
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillText(lines[i], x + 2, ly + 2);

    // Texto principal — primera palabra en color accent
    if (i === 0) {
      const firstSpace = lines[i].indexOf(" ");
      if (firstSpace > 0) {
        const firstWord = lines[i].substring(0, firstSpace);
        const rest = lines[i].substring(firstSpace);
        ctx.fillStyle = palette.accent;
        ctx.fillText(firstWord, x, ly);
        const fwW = ctx.measureText(firstWord).width;
        ctx.fillStyle = palette.text;
        ctx.fillText(rest, x + fwW, ly);
      } else {
        ctx.fillStyle = palette.accent;
        ctx.fillText(lines[i], x, ly);
      }
    } else {
      ctx.fillStyle = palette.text;
      ctx.fillText(lines[i], x, ly);
    }
  }

  return y + lines.length * lineHeight;
}

function drawCompetitorBadges(ctx, competitors, x, y, palette) {
  const fontSize = 13;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  let currentX = x;
  for (const comp of competitors) {
    const tw = ctx.measureText(comp).width;
    const badgeW = tw + 16;
    const badgeH = 24;

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.roundRect(currentX, y, badgeW, badgeH, badgeH / 2);
    ctx.fill();

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(currentX, y, badgeW, badgeH, badgeH / 2);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(comp, currentX + badgeW / 2, y + badgeH / 2);

    currentX += badgeW + 8;
  }
  ctx.textAlign = "left";
}

function drawBrandBar(ctx, w, h, logoImg, palette) {
  const barH = 65;
  const barY = h - barH;

  // Fondo
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0, barY, w, barH);

  // Línea accent
  const lineGrad = ctx.createLinearGradient(0, barY, w, barY);
  lineGrad.addColorStop(0, palette.accent);
  lineGrad.addColorStop(1, palette.accentAlt);
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, barY, w, 3);

  // Logo pequeño
  if (logoImg) {
    const logoH = 45;
    const logoW = logoH * (logoImg.width / logoImg.height);
    ctx.drawImage(logoImg, 12, barY + (barH - logoH) / 2, logoW, logoH);

    // Texto al lado
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Impulsando tu éxito cada día", 12 + logoW + 10, barY + barH / 2);
  }

  // Plataforma & CTA
  ctx.fillStyle = palette.accent;
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("MEGA MAYORISTA", w - 15, barY + barH / 2 - 8);
  ctx.fillStyle = palette.textSub;
  ctx.font = "11px Arial, sans-serif";
  ctx.fillText("mayorista • minorista • importados", w - 15, barY + barH / 2 + 10);
}

// ============================================================================
// LAYOUTS POR PLATAFORMA
// ============================================================================

async function layoutTikTok(ctx, w, h, options, profileImg, logoImg) {
  const { title, keyword, palette, expression, tipoContenido, competitors } = options;

  // Logo en la parte superior
  if (logoImg) {
    ctx.globalAlpha = 0.9;
    drawRealLogo(ctx, logoImg, w / 2 - 140, 30, 280, 120);
    ctx.globalAlpha = 1.0;
  }

  // Foto de perfil GRANDE — lado derecho, parte media-baja
  if (profileImg) {
    const photoSize = 420;
    const photoX = w - photoSize - 30;
    const photoY = h * 0.48;
    drawProfilePhoto(ctx, profileImg, photoX, photoY, photoSize, expression, palette);
  }

  // Título — lado izquierdo
  const titleEnd = drawMainTitle(ctx, title, 35, h * 0.2, w * 0.65, palette, 58);

  // Keyword badge
  if (keyword) {
    ctx.font = "bold 16px Arial, sans-serif";
    const kw = keyword.toUpperCase();
    const kwW = ctx.measureText(kw).width + 24;
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(35, titleEnd + 20, kwW, 32, 16);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(35, titleEnd + 20, kwW, 32, 16);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(kw, 47, titleEnd + 36);
  }

  // Competitors
  if (competitors && competitors.length) {
    drawCompetitorBadges(ctx, competitors.slice(0, 3), 35, h * 0.88, palette);
  }

  // CTA flotante
  const ctaY = h * 0.78;
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(35, ctaY, 250, 48, 24);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Link en bio", 35 + 125, ctaY + 24);

  drawBrandBar(ctx, w, h, logoImg, palette);
}

async function layoutInstagram(ctx, w, h, options, profileImg, logoImg) {
  const { title, keyword, palette, expression, competitors } = options;

  // Logo arriba centrado
  if (logoImg) {
    ctx.globalAlpha = 0.9;
    drawRealLogo(ctx, logoImg, w / 2 - 110, 15, 220, 95);
    ctx.globalAlpha = 1.0;
  }

  // Foto de perfil — abajo derecha
  if (profileImg) {
    const photoSize = 340;
    drawProfilePhoto(ctx, profileImg, w - photoSize - 20, h - photoSize - 85, photoSize, expression, palette);
  }

  // Título — arriba izquierda
  drawMainTitle(ctx, title, 30, 130, w * 0.6, palette, 46);

  // Keyword badge centrado
  if (keyword) {
    const kw = keyword.toUpperCase();
    ctx.font = "bold 14px Arial, sans-serif";
    const kwW = ctx.measureText(kw).width + 24;
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(30, h * 0.62, kwW, 28, 14);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = palette.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(kw, 42, h * 0.62 + 14);
  }

  if (competitors && competitors.length) {
    drawCompetitorBadges(ctx, competitors.slice(0, 2), 30, h * 0.72, palette);
  }

  drawBrandBar(ctx, w, h, logoImg, palette);
}

async function layoutFacebook(ctx, w, h, options, profileImg, logoImg) {
  const { title, keyword, palette, expression, competitors } = options;

  // Layout horizontal: izquierda texto, derecha foto

  // Foto de perfil — lado derecho
  if (profileImg) {
    const photoSize = 280;
    drawProfilePhoto(ctx, profileImg, w - photoSize - 30, h / 2 - photoSize / 2, photoSize, expression, palette);
  }

  // Logo arriba izquierda
  if (logoImg) {
    ctx.globalAlpha = 0.9;
    drawRealLogo(ctx, logoImg, 20, 12, 180, 70);
    ctx.globalAlpha = 1.0;
  }

  // Título — lado izquierdo
  drawMainTitle(ctx, title, 25, 100, w * 0.55, palette, 36);

  // Keyword
  if (keyword) {
    const kw = keyword.toUpperCase();
    ctx.font = "bold 12px Arial, sans-serif";
    const kwW = ctx.measureText(kw).width + 20;
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(25, h - 110, kwW, 24, 12);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = palette.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(kw, 35, h - 98);
  }

  if (competitors && competitors.length) {
    drawCompetitorBadges(ctx, competitors.slice(0, 3), 25, h - 80, palette);
  }

  drawBrandBar(ctx, w, h, logoImg, palette);
}

// ============================================================================
// FUNCIÓN PRINCIPAL ASYNC
// ============================================================================

async function generateThumbnail(options) {
  const {
    title,
    subtitle = "",
    keyword = "",
    platform = "tiktok",
    vertical = "general",
    ctaText = "",
    tipoContenido = "",
    competitors = [],
    outputPath,
  } = options;

  const spec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.tiktok;
  const palette = COLOR_PALETTES[vertical] || COLOR_PALETTES.general;
  const expression = getExpressionForContent(tipoContenido, title);

  const canvas = createCanvas(spec.width, spec.height);
  const ctx = canvas.getContext("2d");

  // Cargar assets
  let profileImg = null;
  let logoImg = null;

  try { profileImg = await loadImage(PROFILE_PATH); } catch (e) { /* sin foto */ }
  try { logoImg = await loadImage(LOGO_PATH); } catch (e) { /* sin logo */ }

  // 1. Fondo con gradiente
  drawGradientBackground(ctx, spec.width, spec.height, palette.gradient);

  // 2. Formas decorativas
  drawDecoShapes(ctx, spec.width, spec.height, palette);

  // 3. Layout según plataforma
  const layoutOpts = {
    title, keyword, palette, expression, tipoContenido, competitors, ctaText,
  };

  if (platform === "tiktok" || platform === "instagram_reel") {
    await layoutTikTok(ctx, spec.width, spec.height, layoutOpts, profileImg, logoImg);
  } else if (platform === "instagram") {
    await layoutInstagram(ctx, spec.width, spec.height, layoutOpts, profileImg, logoImg);
  } else if (platform === "facebook") {
    await layoutFacebook(ctx, spec.width, spec.height, layoutOpts, profileImg, logoImg);
  }

  // Guardar
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  generateThumbnail,
  PLATFORM_SPECS,
  COLOR_PALETTES,
  FACIAL_EXPRESSIONS,
  getExpressionForContent,
};
