/**
 * Cliente Gemini API para generacion de contenido unico
 * Genera ideas, guiones, hashtags creativos usando Google Gemini
 * Maneja errores de API key, cuota, rate limits, etc.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Load API key from environment or .env file
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Try loading from dashboard .env if not in environment
if (!GEMINI_API_KEY) {
  try {
    const envPath = path.resolve(__dirname, "../../dashboard/.env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.+)/);
      if (match) GEMINI_API_KEY = match[1].trim();
    }
  } catch {}
}

// Last error state (exposed for UI)
let lastError = null;

// ============================================================================
// CORE: Call Gemini API with retry support
// ============================================================================
function callGemini(prompt, maxTokens = 1500, retries = 1) {
  return new Promise((resolve, reject) => {
    if (!GEMINI_API_KEY) {
      reject(new Error("GEMINI_API_KEY no configurada"));
      return;
    }

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.95,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: maxTokens,
      },
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          const data = JSON.parse(raw);

          if (data.error) {
            const code = data.error.code || 0;
            const msg = data.error.message || "Error desconocido";

            // Classify error type for UI
            if (code === 429 || data.error.status === "RESOURCE_EXHAUSTED") {
              // Rate limit or quota exceeded - retry once after delay
              if (retries > 0 && msg.includes("retry")) {
                const delayMatch = msg.match(/retry in ([\d.]+)s/i);
                const delay = delayMatch ? Math.ceil(parseFloat(delayMatch[1]) * 1000) : 12000;
                setTimeout(() => {
                  callGemini(prompt, maxTokens, retries - 1).then(resolve).catch(reject);
                }, Math.min(delay, 15000));
                return;
              }
              lastError = { type: "QUOTA_EXCEEDED", code, message: "Cuota de API agotada. Necesitas activar facturacion en Google AI Studio o esperar al reseteo de cuota.", raw: msg };
              reject(new Error(`[QUOTA_EXCEEDED] ${msg}`));
            } else if (code === 401 || code === 403) {
              lastError = { type: "AUTH_ERROR", code, message: "API Key invalida o expirada. Genera una nueva en aistudio.google.com/apikey", raw: msg };
              reject(new Error(`[AUTH_ERROR] ${msg}`));
            } else if (code === 400) {
              lastError = { type: "BAD_REQUEST", code, message: "Solicitud invalida", raw: msg };
              reject(new Error(`[BAD_REQUEST] ${msg}`));
            } else {
              lastError = { type: "API_ERROR", code, message: msg, raw: msg };
              reject(new Error(`[API_ERROR] ${msg}`));
            }
            return;
          }

          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (!text) {
            reject(new Error("Gemini retorno respuesta vacia"));
            return;
          }
          lastError = null; // Clear error on success
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Error parsing Gemini response: ${e.message}`));
        }
      });
    });

    req.on("error", (e) => reject(new Error(`Gemini request failed: ${e.message}`)));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Gemini API timeout (30s)"));
    });
    req.write(body);
    req.end();
  });
}

// ============================================================================
// HELPER: Robust JSON extraction from Gemini responses
// ============================================================================
function extractJSON(text) {
  // Remove markdown code blocks
  let clean = text.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();

  // Try direct parse first
  try { return JSON.parse(clean); } catch {}

  // Try to extract JSON array
  const arrMatch = clean.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }

  // Try to extract JSON object
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  return null;
}

// ============================================================================
// GENERATE UNIQUE CONTENT IDEAS WITH AI
// ============================================================================
async function generateContentIdeasAI(keyword, trends, platforms) {
  const trendList = (trends || []).slice(0, 10).join(", ");
  const year = new Date().getFullYear();
  const platList = platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
  const ideasPerPlatform = Math.max(4, Math.min(8, Math.ceil(20 / platforms.length)));

  const prompt = `Eres un estratega de contenido digital para Mega Mayorista (tienda de productos importados al por mayor en Ecuador/LATAM, año ${year}).

KEYWORD: "${keyword}"
TENDENCIAS RELACIONADAS: ${trendList || "sin tendencias"}
PLATAFORMAS: ${platList}

Genera ${ideasPerPlatform} ideas de contenido por plataforma (${platforms.length * ideasPerPlatform} total). Cada idea DEBE ser:
- ESPECIFICA sobre "${keyword}" (NO generica, NO reutilizable para otro producto)
- UNICA (no repetir patrones como "POV: Descubriste que X...")
- CREATIVA (ganchos diferentes, angulos variados)
- ACTUAL (tendencias ${year}, formatos que funcionan HOY)

Tipos de contenido a variar: unboxing, comparativa de precios, tutorial de reventa, reto/challenge, reaccion, storytelling de cliente, ranking/top, hack o tip, mito vs realidad, dato curioso, transformacion, encuesta, detras de camaras, respuesta a comentario.

IMPORTANTE:
- Los titulos NO deben parecer generados por plantilla
- Cada titulo debe tener un angulo DIFERENTE sobre "${keyword}"
- Incluye numeros especificos, precios, o datos cuando sea posible
- Piensa como un creador de contenido real, no como una plantilla

Responde SOLO con un JSON array (sin texto extra):
[{"plataforma":"TikTok","titulo":"...","tipo":"...","keyword":"${keyword}","prioridad":"Alta|Muy Alta|Media"}]`;

  try {
    const response = await callGemini(prompt, 2500, 1);
    const ideas = extractJSON(response);
    if (Array.isArray(ideas) && ideas.length >= 3) {
      // Normalize and validate
      return ideas.map(idea => ({
        plataforma: idea.plataforma || platforms[0],
        titulo: idea.titulo || idea.title || "",
        titulo_contenido: idea.titulo || idea.title || "",
        tipo_contenido: idea.tipo || idea.type || "General",
        tipo: idea.tipo || idea.type || "General",
        keyword_principal: keyword,
        keyword: keyword,
        vertical: idea.vertical || "General",
        prioridad: idea.prioridad || "Alta",
      })).filter(i => i.titulo.length > 10);
    }
    return null;
  } catch (e) {
    console.log(`   [Gemini] Ideas generation failed: ${e.message}`);
    return null;
  }
}

// ============================================================================
// GENERATE SCRIPTS PER PLATFORM
// ============================================================================
async function generateTikTokScriptAI(idea) {
  const prompt = `Genera un guion UNICO para TikTok de Mega Mayorista (productos importados al por mayor, Ecuador).

VIDEO: "${idea.titulo_contenido}"
KEYWORD: "${idea.keyword_principal}"
TIPO: ${idea.tipo_contenido}

Responde SOLO en JSON:
{"hook":{"duracion":"0:00-0:03","texto_pantalla":"(texto overlay con emojis)","accion":"(que se ve)","nota":"(tip produccion)"},"cuerpo":[{"duracion":"0:03-0:08","seccion":"PROBLEMA","texto_pantalla":"(overlay)","accion":"(visual)"},{"duracion":"0:08-0:20","seccion":"DEMO","texto_pantalla":"(overlay)","accion":"(visual)"},{"duracion":"0:20-0:30","seccion":"BENEFICIOS","texto_pantalla":"(overlay)","accion":"(visual)"},{"duracion":"0:30-0:40","seccion":"PRECIO","texto_pantalla":"(overlay)","accion":"(visual)"}],"cta":{"duracion":"0:40-0:45","texto_pantalla":"(CTA)","accion":"(visual)"},"metadata":{"duracion_total":"15-45s","sonido_sugerido":"(sonido trending especifico)","velocidad":"(edicion)"}}

REGLAS: Hook unico para "${idea.keyword_principal}". Lenguaje coloquial LATAM. Datos/cifras especificos. NO generico.`;

  try {
    const response = await callGemini(prompt, 1000, 1);
    const parsed = extractJSON(response);
    if (parsed && parsed.hook) return parsed;
    return null;
  } catch (e) {
    console.log(`   [Gemini] TikTok: ${e.message.slice(0, 80)}`);
    return null;
  }
}

async function generateInstagramScriptAI(idea) {
  const isCarousel = (idea.tipo_contenido || "").toLowerCase().includes("carousel");
  const isReel = (idea.tipo_contenido || "").toLowerCase().includes("reel") || (idea.tipo_contenido || "").toLowerCase().includes("story");

  const prompt = `Genera contenido UNICO para Instagram de Mega Mayorista (productos importados, Ecuador).

TEMA: "${idea.titulo_contenido}"
KEYWORD: "${idea.keyword_principal}"
FORMATO: ${isCarousel ? "CAROUSEL" : isReel ? "REEL" : "POST"}

Responde SOLO en JSON:
{"caption":{"primera_linea":"(hook con emoji, ESPECIFICO sobre ${idea.keyword_principal})","cuerpo":["(enganche emocional)","","(problema)","(solucion)","","(beneficio 1 con emoji)","(beneficio 2)","(beneficio 3)","","(social proof/dato)","","(CTA)","(CTA secundario)"]}${isCarousel ? ',"carousel":{"slide_1":"PORTADA","slide_2":"contexto","slide_3":"punto 1","slide_4":"punto 2","slide_5":"punto 3","slide_6":"punto 4","slide_7":"punto 5","slide_8":"resumen","slide_9":"CTA","slide_10":"bonus"}' : ""}${isReel ? ',"reel":{"0_1s":"HOOK","1_5s":"problema","5_15s":"demo","15_25s":"beneficios","25_30s":"CTA"}' : ""}}

REGLAS: Especifico sobre "${idea.keyword_principal}". Cifras creibles. Lenguaje LATAM. NO generico.`;

  try {
    const response = await callGemini(prompt, 1000, 1);
    const parsed = extractJSON(response);
    if (parsed && parsed.caption) return parsed;
    return null;
  } catch (e) {
    console.log(`   [Gemini] Instagram: ${e.message.slice(0, 80)}`);
    return null;
  }
}

async function generateFacebookScriptAI(idea) {
  const prompt = `Genera un post UNICO para Facebook de Mega Mayorista (productos importados al por mayor, Ecuador).

TEMA: "${idea.titulo_contenido}"
KEYWORD: "${idea.keyword_principal}"

Responde SOLO en JSON:
{"gancho_inicial":"(frase impactante sobre ${idea.keyword_principal})","cuerpo":["(historia/pregunta emocional)","","(producto/solucion)","","(titulo seccion beneficios)","","(beneficio 1 emoji)","(beneficio 2 emoji)","(beneficio 3 emoji)","(beneficio 4 emoji)","","(testimonial con nombre ecuatoriano)","","(urgencia/escasez)","","(CTA claro)"],"imagen_sugerida":"(descripcion imagen)","mejor_horario":"(horario Ecuador)"}

REGLAS: Sobre "${idea.keyword_principal}" NO generico. Precios realistas. Tono cercano LATAM.`;

  try {
    const response = await callGemini(prompt, 1000, 1);
    const parsed = extractJSON(response);
    if (parsed && parsed.gancho_inicial) return parsed;
    return null;
  } catch (e) {
    console.log(`   [Gemini] Facebook: ${e.message.slice(0, 80)}`);
    return null;
  }
}

async function generateHashtagsAI(idea, platform) {
  const prompt = `20 hashtags para ${platform} sobre "${idea.keyword_principal}" (Mega Mayorista, mayorista LATAM).
Mix: 5 alto volumen + 8 nicho "${idea.keyword_principal}" + 4 comunidad latina + 3 marca.
Responde SOLO hashtags separados por espacios: #tag1 #tag2 #tag3`;

  try {
    const response = await callGemini(prompt, 300, 0);
    const hashtags = response.split(/[\s,]+/).filter(h => h.startsWith("#") && h.length > 2).slice(0, 20);
    return hashtags.length >= 5 ? hashtags : null;
  } catch {
    return null;
  }
}

// ============================================================================
// API KEY STATUS AND TESTING
// ============================================================================
async function isGeminiAvailable() {
  if (!GEMINI_API_KEY) return false;
  try {
    const response = await callGemini("Responde exactamente: OK", 10, 0);
    return response.toLowerCase().includes("ok");
  } catch {
    return false;
  }
}

function getApiKeyStatus() {
  if (!GEMINI_API_KEY) return { configured: false, key: null, error: null };
  return {
    configured: true,
    key: GEMINI_API_KEY.slice(0, 6) + "..." + GEMINI_API_KEY.slice(-4),
    error: lastError,
  };
}

/**
 * Detailed API key test - returns specific error info
 */
async function testApiKey() {
  if (!GEMINI_API_KEY) {
    return { ok: false, error: "NO_KEY", message: "API Key no configurada" };
  }
  try {
    const response = await callGemini("Responde exactamente: OK", 10, 0);
    if (response.toLowerCase().includes("ok")) {
      lastError = null;
      return { ok: true, error: null, message: "API Key funcional" };
    }
    return { ok: false, error: "BAD_RESPONSE", message: "Gemini respondio pero no correctamente" };
  } catch (e) {
    const msg = e.message || "";
    if (msg.includes("QUOTA_EXCEEDED")) {
      return { ok: false, error: "QUOTA_EXCEEDED", message: "Cuota agotada. Activa facturacion en Google AI Studio o usa otra API Key." };
    }
    if (msg.includes("AUTH_ERROR")) {
      return { ok: false, error: "AUTH_ERROR", message: "API Key invalida o expirada. Genera una nueva en aistudio.google.com/apikey" };
    }
    return { ok: false, error: "CONNECTION_ERROR", message: `No se pudo conectar: ${msg.slice(0, 100)}` };
  }
}

function getLastError() {
  return lastError;
}

module.exports = {
  callGemini,
  extractJSON,
  generateContentIdeasAI,
  generateTikTokScriptAI,
  generateInstagramScriptAI,
  generateFacebookScriptAI,
  generateHashtagsAI,
  isGeminiAvailable,
  getApiKeyStatus,
  testApiKey,
  getLastError,
};
