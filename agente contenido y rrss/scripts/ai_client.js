/**
 * Cliente Multi-IA unificado para generacion de contenido
 * Soporta: Gemini, OpenAI (ChatGPT), Anthropic (Claude)
 * Round-robin + failover automatico entre proveedores
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Import existing Gemini client (used as dependency, not modified)
const gemini = require("./gemini_client");

// ============================================================================
// LOAD API KEYS
// ============================================================================
const ENV_PATH = path.resolve(__dirname, "../../dashboard/.env");

function loadEnvKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    if (fs.existsSync(ENV_PATH)) {
      const content = fs.readFileSync(ENV_PATH, "utf8");
      const match = content.match(new RegExp(`^${name}[ \\t]*=[ \\t]*([^\\r\\n]+)`, "m"));
      if (match) return match[1].trim();
    }
  } catch {}
  return "";
}

let OPENAI_API_KEY = loadEnvKey("OPENAI_API_KEY");
let ANTHROPIC_API_KEY = loadEnvKey("ANTHROPIC_API_KEY");

// Round-robin index for provider rotation
let rrIndex = 0;

// Last errors per provider
const lastErrors = { gemini: null, openai: null, anthropic: null };

// ============================================================================
// CORE: Call OpenAI API (ChatGPT)
// ============================================================================
function callOpenAI(prompt, maxTokens = 1500) {
  return new Promise((resolve, reject) => {
    if (!OPENAI_API_KEY) {
      reject(new Error("OPENAI_API_KEY no configurada"));
      return;
    }

    const body = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.95,
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
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
            const code = res.statusCode || 0;
            const msg = data.error.message || "Error desconocido";

            if (code === 429) {
              lastErrors.openai = { type: "QUOTA_EXCEEDED", code, message: "Cuota de OpenAI agotada o rate limit alcanzado.", raw: msg };
              reject(new Error(`[QUOTA_EXCEEDED] ${msg}`));
            } else if (code === 401) {
              lastErrors.openai = { type: "AUTH_ERROR", code, message: "API Key de OpenAI invalida. Genera una nueva en platform.openai.com/api-keys", raw: msg };
              reject(new Error(`[AUTH_ERROR] ${msg}`));
            } else {
              lastErrors.openai = { type: "API_ERROR", code, message: msg, raw: msg };
              reject(new Error(`[API_ERROR] ${msg}`));
            }
            return;
          }

          const text = data.choices?.[0]?.message?.content || "";
          if (!text) {
            reject(new Error("OpenAI retorno respuesta vacia"));
            return;
          }
          lastErrors.openai = null;
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Error parsing OpenAI response: ${e.message}`));
        }
      });
    });

    req.on("error", (e) => reject(new Error(`OpenAI request failed: ${e.message}`)));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("OpenAI API timeout (30s)"));
    });
    req.write(body);
    req.end();
  });
}

// ============================================================================
// CORE: Call Anthropic API (Claude)
// ============================================================================
function callAnthropic(prompt, maxTokens = 1500) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) {
      reject(new Error("ANTHROPIC_API_KEY no configurada"));
      return;
    }

    const body = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
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

          if (data.type === "error" || data.error) {
            const code = res.statusCode || 0;
            const errObj = data.error || {};
            const msg = errObj.message || "Error desconocido";

            if (code === 429) {
              lastErrors.anthropic = { type: "QUOTA_EXCEEDED", code, message: "Rate limit de Anthropic alcanzado.", raw: msg };
              reject(new Error(`[QUOTA_EXCEEDED] ${msg}`));
            } else if (code === 401) {
              lastErrors.anthropic = { type: "AUTH_ERROR", code, message: "API Key de Claude invalida. Genera una nueva en console.anthropic.com", raw: msg };
              reject(new Error(`[AUTH_ERROR] ${msg}`));
            } else {
              lastErrors.anthropic = { type: "API_ERROR", code, message: msg, raw: msg };
              reject(new Error(`[API_ERROR] ${msg}`));
            }
            return;
          }

          const text = data.content?.[0]?.text || "";
          if (!text) {
            reject(new Error("Claude retorno respuesta vacia"));
            return;
          }
          lastErrors.anthropic = null;
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Error parsing Anthropic response: ${e.message}`));
        }
      });
    });

    req.on("error", (e) => reject(new Error(`Anthropic request failed: ${e.message}`)));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Anthropic API timeout (30s)"));
    });
    req.write(body);
    req.end();
  });
}

// ============================================================================
// UNIFIED: Call AI with round-robin + failover
// ============================================================================
function getAvailableProviders() {
  const providers = [];
  // Check Gemini via its own key status
  const geminiStatus = gemini.getApiKeyStatus();
  if (geminiStatus.configured) providers.push("gemini");
  if (OPENAI_API_KEY) providers.push("openai");
  if (ANTHROPIC_API_KEY) providers.push("anthropic");
  return providers;
}

const PROVIDER_CALLERS = {
  gemini: (prompt, maxTokens) => gemini.callGemini(prompt, maxTokens, 1),
  openai: callOpenAI,
  anthropic: callAnthropic,
};

async function callAI(prompt, maxTokens = 1500) {
  const available = getAvailableProviders();
  if (available.length === 0) {
    throw new Error("No hay proveedores de IA configurados");
  }

  // Round-robin: start from rrIndex, try all available
  const startIdx = rrIndex % available.length;
  rrIndex++;
  const errors = [];

  for (let i = 0; i < available.length; i++) {
    const idx = (startIdx + i) % available.length;
    const provider = available[idx];
    const caller = PROVIDER_CALLERS[provider];

    try {
      const result = await caller(prompt, maxTokens);
      return result;
    } catch (e) {
      console.log(`   [AI] ${provider} failed: ${e.message.slice(0, 80)}`);
      errors.push({ provider, error: e.message });
    }
  }

  throw new Error(`Todos los proveedores de IA fallaron: ${errors.map(e => `${e.provider}: ${e.error.slice(0, 50)}`).join(" | ")}`);
}

// ============================================================================
// CONTENT GENERATION FUNCTIONS (using callAI instead of callGemini)
// ============================================================================
async function generateContentIdeasAI(keyword, trends, platforms, ideasPerPlatform = 7) {
  const trendList = (trends || []).slice(0, 10).join(", ");
  const year = new Date().getFullYear();
  const platList = platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
  const randomSeed = Math.floor(Math.random() * 99999);

  const prompt = `Eres un creador de contenido viral en LATAM. Genera ideas para Mega Mayorista (productos importados al por mayor, Ecuador, ano ${year}).

KEYWORD: "${keyword}"
TENDENCIAS HOY: ${trendList || "sin tendencias"}
PLATAFORMAS: ${platList}
SEED ALEATORIA: ${randomSeed}

Genera ${ideasPerPlatform} ideas COMPLETAMENTE DIFERENTES por plataforma (${platforms.length * ideasPerPlatform} total).

REGLA DE ORO: Cada titulo debe ser tan UNICO que jamas podria confundirse con otro. NO uses estos patrones repetitivos:
- "X cosas que..." / "Top X..." / "Los X mejores..."
- "POV: Descubriste que..."
- "Mito o realidad..."
- "Antes y despues..."

EN CAMBIO, usa angulos FRESCOS como:
- Historias personales ("El dia que encontre...")
- Controversia ("Por que NUNCA deberias comprar...")
- Humor ("Le regale ${keyword} a mi abuela y...")
- Curiosidad extrema ("Abri ${keyword} de $2 y de $200 y...")
- Urgencia real ("${keyword} se va a agotar porque...")
- Educativo sin ser aburrido ("La ciencia detras de...")
- Experiencia directa ("Llevo 6 meses usando...")

IMPORTANTE: Piensa titulos que TU harias clic. No titulos corporativos.

Responde SOLO JSON array:
[{"plataforma":"TikTok","titulo":"...","tipo":"(formato libre)","keyword":"${keyword}","prioridad":"Alta|Muy Alta|Media"}]`;

  try {
    const maxTokens = ideasPerPlatform <= 2 ? 1200 : 2500;
    const response = await callAI(prompt, maxTokens);
    const ideas = gemini.extractJSON(response);
    if (Array.isArray(ideas) && ideas.length >= 2) {
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
    console.log(`   [AI] Ideas generation failed: ${e.message}`);
    return null;
  }
}

// Random style/angle selectors for maximum variety
const TIKTOK_STYLES = [
  "POV/primera persona inmersivo",
  "Storytime dramatico con giros",
  "Comparativa lado a lado con precios",
  "Reto o challenge con resultado inesperado",
  "Tutorial rapido paso a paso",
  "Reaccion genuina tipo 'no sabia que esto existia'",
  "Antes/despues con transformacion visual",
  "Respuesta a comentario inventado",
  "ASMR unboxing con close-ups",
  "Ranking con debate en comentarios",
  "Dato curioso que nadie sabe",
  "Un dia en la vida usando el producto",
];

const IG_STYLES = [
  "Carousel educativo tipo infografia",
  "Reel cinematografico con transiciones",
  "Mini documental de 30s del producto",
  "Meme relatable + producto",
  "Detras de camaras del negocio",
  "Colaboracion ficticia con creador",
  "Carrusel de mitos vs realidades",
  "Story interactiva con encuestas",
  "Estetica minimalista tipo catalogo premium",
  "Reel con voz en off tipo documental",
];

const FB_STYLES = [
  "Testimonio emocional de un emprendedor real",
  "Post tipo lista con emojis y beneficios claros",
  "Historia personal del dueno del negocio",
  "Pregunta polemica para generar debate",
  "Caso de exito con numeros reales",
  "Comparativa detallada con tabla de precios",
  "Post educativo tipo 'sabias que...'",
  "Oferta flash con urgencia real",
  "Guia completa para principiantes",
  "Encuesta con opciones divertidas",
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function generateTikTokScriptAI(idea) {
  const style = pickRandom(TIKTOK_STYLES);
  const prompt = `Eres un creador de TikTok exitoso en Ecuador. Genera un guion COMPLETAMENTE ORIGINAL para Mega Mayorista (productos importados al por mayor).

VIDEO: "${idea.titulo_contenido}"
KEYWORD: "${idea.keyword_principal}"
ESTILO OBLIGATORIO: ${style}

El guion debe ser DIFERENTE a cualquier otro. NO uses la estructura tipica de "problema-solucion-CTA".
Usa el estilo "${style}" de forma creativa y autentica.

Responde SOLO en JSON:
{"hook":{"duracion":"0:00-0:03","texto_pantalla":"(overlay creativo con emojis)","accion":"(que se ve en camara)","nota":"(tip de produccion)"},"cuerpo":[{"duracion":"(tiempo)","seccion":"(nombre libre de la seccion)","texto_pantalla":"(overlay)","accion":"(visual especifica)"}],"cta":{"duracion":"(tiempo)","texto_pantalla":"(CTA natural, NO forzado)","accion":"(visual)"},"metadata":{"duracion_total":"15-60s","sonido_sugerido":"(cancion o sonido trending REAL y especifico)","estilo":"${style}"}}

IMPORTANTE: Cada seccion del cuerpo puede tener nombre LIBRE (no siempre PROBLEMA/DEMO/BENEFICIOS). Inventa secciones creativas. Lenguaje coloquial LATAM. Precios en USD.`;

  try {
    const response = await callAI(prompt, 1200);
    const parsed = gemini.extractJSON(response);
    if (parsed && parsed.hook) return parsed;
    return null;
  } catch (e) {
    console.log(`   [AI] TikTok: ${e.message.slice(0, 80)}`);
    return null;
  }
}

async function generateInstagramScriptAI(idea) {
  const style = pickRandom(IG_STYLES);
  const prompt = `Eres un content manager de Instagram top en LATAM. Genera contenido COMPLETAMENTE ORIGINAL para Mega Mayorista (productos importados al por mayor, Ecuador).

TEMA: "${idea.titulo_contenido}"
KEYWORD: "${idea.keyword_principal}"
ESTILO OBLIGATORIO: ${style}

NO copies la estructura tipica de "hook-problema-solucion-CTA". Crea algo FRESCO usando "${style}".

Responde SOLO en JSON:
{"caption":{"primera_linea":"(gancho irresistible con emoji, usa el estilo ${style})","cuerpo":["(lineas del caption, cada una en un string separado, minimo 8 lineas, maximo 15)"]},"visual":{"formato":"${style}","descripcion":"(como se ve visualmente el post/reel/carousel)","slides_o_escenas":["(descripcion de cada slide o escena visual)"]},"engagement_hooks":["(3 preguntas o CTAs para comentarios)"]}

IMPORTANTE: El caption debe sentirse HUMANO, no corporativo. Lenguaje LATAM. Precios en USD. Emojis naturales (no excesivos).`;

  try {
    const response = await callAI(prompt, 1200);
    const parsed = gemini.extractJSON(response);
    if (parsed && parsed.caption) return parsed;
    return null;
  } catch (e) {
    console.log(`   [AI] Instagram: ${e.message.slice(0, 80)}`);
    return null;
  }
}

async function generateFacebookScriptAI(idea) {
  const style = pickRandom(FB_STYLES);
  const prompt = `Eres un copywriter experto en Facebook Ads y contenido organico para LATAM. Genera un post COMPLETAMENTE ORIGINAL para Mega Mayorista (productos importados al por mayor, Ecuador).

TEMA: "${idea.titulo_contenido}"
KEYWORD: "${idea.keyword_principal}"
ESTILO OBLIGATORIO: ${style}

NO uses la estructura generica de "gancho-beneficios-CTA". Crea algo UNICO con el estilo "${style}".

Responde SOLO en JSON:
{"gancho_inicial":"(primera frase IMPACTANTE que use el estilo ${style})","cuerpo":["(cada linea del post en un string separado, minimo 10 lineas, maximo 18, con saltos de linea vacios para legibilidad)"],"engagement_hooks":["(3 preguntas para generar comentarios)"],"imagen_sugerida":"(descripcion detallada de la imagen ideal)","mejor_horario":"(horario especifico para Ecuador)"}

IMPORTANTE: Debe sentirse como un post REAL de Facebook, no un anuncio corporativo. Incluye emojis naturales, precios en USD, lenguaje coloquial LATAM.`;

  try {
    const response = await callAI(prompt, 1200);
    const parsed = gemini.extractJSON(response);
    if (parsed && parsed.gancho_inicial) return parsed;
    return null;
  } catch (e) {
    console.log(`   [AI] Facebook: ${e.message.slice(0, 80)}`);
    return null;
  }
}

async function generateHashtagsAI(idea, platform) {
  const prompt = `20 hashtags para ${platform} sobre "${idea.keyword_principal}" (Mega Mayorista, mayorista LATAM).
Mix: 5 alto volumen + 8 nicho "${idea.keyword_principal}" + 4 comunidad latina + 3 marca.
Responde SOLO hashtags separados por espacios: #tag1 #tag2 #tag3`;

  try {
    const response = await callAI(prompt, 300);
    const hashtags = response.split(/[\s,]+/).filter(h => h.startsWith("#") && h.length > 2).slice(0, 20);
    return hashtags.length >= 5 ? hashtags : null;
  } catch {
    return null;
  }
}

// ============================================================================
// PROVIDER MANAGEMENT
// ============================================================================
async function getAllProvidersStatus() {
  const providers = {};

  // Gemini
  const gStatus = gemini.getApiKeyStatus();
  providers.gemini = {
    name: "Gemini",
    configured: gStatus.configured,
    key: gStatus.key,
    error: null,
    status: "unknown",
  };
  if (gStatus.configured) {
    try {
      const test = await gemini.testApiKey();
      providers.gemini.status = test.ok ? "active" : "error";
      if (!test.ok) providers.gemini.error = test;
    } catch (e) {
      providers.gemini.status = "error";
      providers.gemini.error = { ok: false, error: "TEST_FAILED", message: e.message };
    }
  } else {
    providers.gemini.status = "not_configured";
  }

  // OpenAI
  OPENAI_API_KEY = loadEnvKey("OPENAI_API_KEY");
  providers.openai = {
    name: "ChatGPT",
    configured: !!OPENAI_API_KEY,
    key: OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 6) + "..." + OPENAI_API_KEY.slice(-4) : null,
    error: null,
    status: "unknown",
  };
  if (OPENAI_API_KEY) {
    try {
      await callOpenAI("Responde exactamente: OK", 10);
      providers.openai.status = "active";
    } catch (e) {
      providers.openai.status = "error";
      const msg = e.message || "";
      if (msg.includes("QUOTA_EXCEEDED")) {
        providers.openai.error = { ok: false, error: "QUOTA_EXCEEDED", message: "Cuota agotada o rate limit alcanzado." };
      } else if (msg.includes("AUTH_ERROR")) {
        providers.openai.error = { ok: false, error: "AUTH_ERROR", message: "API Key invalida. Genera una nueva en platform.openai.com/api-keys" };
      } else {
        providers.openai.error = { ok: false, error: "CONNECTION_ERROR", message: msg.slice(0, 100) };
      }
    }
  } else {
    providers.openai.status = "not_configured";
  }

  // Anthropic
  ANTHROPIC_API_KEY = loadEnvKey("ANTHROPIC_API_KEY");
  providers.anthropic = {
    name: "Claude",
    configured: !!ANTHROPIC_API_KEY,
    key: ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.slice(0, 6) + "..." + ANTHROPIC_API_KEY.slice(-4) : null,
    error: null,
    status: "unknown",
  };
  if (ANTHROPIC_API_KEY) {
    try {
      await callAnthropic("Responde exactamente: OK", 10);
      providers.anthropic.status = "active";
    } catch (e) {
      providers.anthropic.status = "error";
      const msg = e.message || "";
      if (msg.includes("QUOTA_EXCEEDED")) {
        providers.anthropic.error = { ok: false, error: "QUOTA_EXCEEDED", message: "Rate limit alcanzado." };
      } else if (msg.includes("AUTH_ERROR")) {
        providers.anthropic.error = { ok: false, error: "AUTH_ERROR", message: "API Key invalida. Genera una nueva en console.anthropic.com" };
      } else {
        providers.anthropic.error = { ok: false, error: "CONNECTION_ERROR", message: msg.slice(0, 100) };
      }
    }
  } else {
    providers.anthropic.status = "not_configured";
  }

  const activeCount = Object.values(providers).filter(p => p.status === "active").length;
  return { providers, activeCount };
}

function setProviderKey(provider, key) {
  const envMap = { gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
  const envName = envMap[provider];
  if (!envName) throw new Error(`Proveedor desconocido: ${provider}`);

  let envContent = "";
  try { envContent = fs.readFileSync(ENV_PATH, "utf8"); } catch {}

  const regex = new RegExp(`${envName}\\s*=.*`);
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${envName}=${key}`);
  } else {
    envContent += `\n${envName}=${key}\n`;
  }
  fs.writeFileSync(ENV_PATH, envContent, "utf8");
  process.env[envName] = key;

  // Update in-memory keys
  if (provider === "openai") OPENAI_API_KEY = key;
  if (provider === "anthropic") ANTHROPIC_API_KEY = key;

  // Clear gemini cache if updating gemini key
  if (provider === "gemini") {
    const geminiPath = require.resolve("./gemini_client");
    delete require.cache[geminiPath];
  }
}

function removeProviderKey(provider) {
  const envMap = { gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
  const envName = envMap[provider];
  if (!envName) throw new Error(`Proveedor desconocido: ${provider}`);

  let envContent = "";
  try { envContent = fs.readFileSync(ENV_PATH, "utf8"); } catch {}

  // Remove the line entirely
  envContent = envContent.replace(new RegExp(`\\n?${envName}\\s*=.*`, "g"), "");
  fs.writeFileSync(ENV_PATH, envContent, "utf8");
  delete process.env[envName];

  if (provider === "openai") OPENAI_API_KEY = "";
  if (provider === "anthropic") ANTHROPIC_API_KEY = "";

  if (provider === "gemini") {
    const geminiPath = require.resolve("./gemini_client");
    delete require.cache[geminiPath];
  }
}

// ============================================================================
// COMPATIBILITY ALIASES (for code that uses gemini_client API)
// ============================================================================
function isGeminiAvailable() {
  return gemini.isGeminiAvailable();
}

function isAIAvailable() {
  return getAvailableProviders().length > 0;
}

function getApiKeyStatus() {
  return gemini.getApiKeyStatus();
}

async function testApiKey() {
  return gemini.testApiKey();
}

function getLastError() {
  return gemini.getLastError();
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  // Unified AI
  callAI,
  callOpenAI,
  callAnthropic,
  getAvailableProviders,
  isAIAvailable,

  // Content generation (use callAI internally)
  generateContentIdeasAI,
  generateTikTokScriptAI,
  generateInstagramScriptAI,
  generateFacebookScriptAI,
  generateHashtagsAI,

  // Provider management
  getAllProvidersStatus,
  setProviderKey,
  removeProviderKey,

  // Compatibility aliases (from gemini_client)
  callGemini: gemini.callGemini,
  extractJSON: gemini.extractJSON,
  isGeminiAvailable,
  getApiKeyStatus,
  testApiKey,
  getLastError,
};
