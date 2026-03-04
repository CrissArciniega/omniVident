const express = require('express');
const auth = require('../middleware/auth');
const { getProducts, getSummary, getCountries, getCategories, getSources, getTrends, getMarketStudy, getReport } = require('../services/marketParser');

const router = express.Router();

router.get('/products', auth, (req, res) => {
  try {
    const { country, category, sort, source, page, limit } = req.query;
    const result = getProducts({
      country,
      category,
      sort,
      source,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    console.error('[Market] Error products:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/summary', auth, (req, res) => {
  try {
    res.json(getSummary());
  } catch (err) {
    console.error('[Market] Error summary:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/countries', auth, (req, res) => {
  try {
    res.json(getCountries());
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/categories', auth, (req, res) => {
  try {
    res.json(getCategories());
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/sources', auth, (req, res) => {
  try {
    res.json(getSources());
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/trends', auth, (req, res) => {
  try {
    const trends = getTrends();
    if (!trends) {
      return res.json({ trends: null, message: 'No hay datos de tendencias disponibles' });
    }
    res.json(trends);
  } catch (err) {
    console.error('[Market] Error trends:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/market-study', auth, (req, res) => {
  try {
    const { country } = req.query;
    const study = getMarketStudy(country);
    if (!study) {
      return res.json({ study: null, message: 'No hay datos disponibles para el estudio de mercado' });
    }
    res.json(study);
  } catch (err) {
    console.error('[Market] Error market-study:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/report', auth, (req, res) => {
  try {
    const report = getReport();
    if (!report) {
      return res.type('html').send(`<!DOCTYPE html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;color:#888;background:#f9fafb"><div style="text-align:center"><p style="font-size:40px;margin-bottom:12px">📊</p><p style="font-size:16px;font-weight:500">No hay reporte disponible</p><p style="font-size:13px;margin-top:8px">Ejecuta el agente de Estudio de Mercado para generar uno.</p></div></body></html>`);
    }
    res.type('html').send(report);
  } catch (err) {
    console.error('[Market] Error report:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// AI-powered market insights
router.get('/insights', auth, async (req, res) => {
  try {
    const summary = getSummary();
    if (!summary || summary.totalProducts === 0) {
      return res.json({ insights: null });
    }

    // Get top products for context
    const topML = getProducts({ sort: 'sold', source: 'mercadolibre', page: 1, limit: 10 });
    const topAMZ = getProducts({ sort: 'ranking', source: 'amazon', page: 1, limit: 10 });
    const trends = getTrends();

    // Check for cached insights (reuse if data hasn't changed)
    const fs = require('fs');
    const path = require('path');
    const { resolveAgentPath } = require('../services/stateWatcher');
    const cacheFile = resolveAgentPath('../agente de seo y product hunt/outputs/market_insights_cache.json');

    const forceRefresh = req.query.refresh === '1';
    try {
      if (!forceRefresh && fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        // Reuse if same product count (data hasn't changed)
        if (cached.totalProducts === summary.totalProducts && cached.insights) {
          return res.json({ insights: cached.insights, cached: true });
        }
      }
    } catch {}

    // Build context for AI — now with both sources and trends
    const mlList = topML.products.map((p, i) =>
      `${i + 1}. [ML] "${p.title}" - ${p.country} - $${p.price} ${p.currency} - ${p.soldQuantity} vendidos - ${p.rating}★ - ${p.category}`
    ).join('\n');

    const amzList = topAMZ.products.map((p, i) =>
      `${i + 1}. [AMZ] "${p.title}" - ${p.country} - $${p.price} ${p.currency} - Rank #${p.ranking || 'N/A'} - ${p.rating}★ - ${p.category}`
    ).join('\n');

    const catSummary = summary.topCategories.map(c => `${c.name}: ${c.count} productos`).join(', ');
    const countrySummary = Object.entries(summary.byCountry).map(([c, n]) => `${c}: ${n}`).join(', ');
    const sourceSummary = Object.entries(summary.bySource || {}).map(([s, n]) => `${s}: ${n}`).join(', ');

    // Add trend context if available
    let trendContext = '';
    if (trends && trends.summary) {
      const ts = trends.summary;
      trendContext = `
TENDENCIAS DETECTADAS:
- ${ts.new_products} productos nuevos en ranking
- ${ts.dropped_products} productos salieron del ranking
- ${ts.price_changes} cambios de precio significativos (>5%)
- ${ts.ranking_changes} cambios de ranking significativos (>3 posiciones)
- ${ts.sales_velocity_changes} cambios en velocidad de ventas`;

      if (trends.priceChanges && trends.priceChanges.length > 0) {
        const topPriceChanges = trends.priceChanges.slice(0, 5).map(c =>
          `  "${c.title.substring(0, 40)}" ${c.pct_change > 0 ? '+' : ''}${c.pct_change}%`
        ).join('\n');
        trendContext += `\n\nCAMBIOS DE PRECIO NOTABLES:\n${topPriceChanges}`;
      }

      if (trends.categoryTrends && trends.categoryTrends.length > 0) {
        const topCatTrends = trends.categoryTrends.slice(0, 5).map(c =>
          `  ${c.category}: ${c.trend === 'growing' ? '📈' : '📉'} ${c.change_pct > 0 ? '+' : ''}${c.change_pct}%`
        ).join('\n');
        trendContext += `\n\nTENDENCIAS POR CATEGORIA:\n${topCatTrends}`;
      }
    }

    const prompt = `Eres un analista de mercado experto en e-commerce LATAM. Analiza estos datos de MercadoLibre y Amazon (${new Date().toISOString().split('T')[0]}):

RESUMEN: ${summary.totalProducts} productos | Fuentes: ${sourceSummary} | Paises: ${countrySummary} | Categorias top: ${catSummary}

TOP MERCADOLIBRE (mas vendidos B2C LATAM):
${mlList || '(sin datos ML)'}

TOP AMAZON (bestsellers B2C):
${amzList || '(sin datos Amazon)'}
${trendContext}

Genera un analisis BREVE y ACCIONABLE en formato JSON con esta estructura exacta:
{
  "tendencia_principal": "Frase corta sobre la tendencia dominante del mercado",
  "oportunidades": ["Oportunidad 1 especifica y accionable", "Oportunidad 2", "Oportunidad 3"],
  "productos_estrella": "Analisis de los productos mas vendidos y por que destacan",
  "comparacion_marketplaces": "Diferencias clave entre MercadoLibre y Amazon. Que vende mas en cada plataforma y oportunidades de arbitraje",
  "alerta_mercado": "Algo importante que un importador mayorista debe saber HOY",
  "tendencias_temporales": "Que cambio respecto a la recoleccion anterior (si hay datos de tendencias)",
  "recomendacion": "Recomendacion especifica para Mega Mayorista (importador al por mayor en Ecuador)"
}

IMPORTANTE: Se conciso, usa datos reales del analisis, no generalices. Cada insight debe ser unico y basado en los datos.`;

    // Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.json({ insights: null, error: 'No API key configured' });
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.8,
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);

      // Cache it
      try {
        fs.writeFileSync(cacheFile, JSON.stringify({
          totalProducts: summary.totalProducts,
          insights,
          generatedAt: new Date().toISOString(),
        }, null, 2), 'utf8');
      } catch {}

      return res.json({ insights, cached: false });
    }

    res.json({ insights: null, error: 'Could not parse AI response' });
  } catch (err) {
    console.error('[Market] Error insights:', err.message);
    res.json({ insights: null, error: err.message });
  }
});

module.exports = router;
