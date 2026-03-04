const fs = require('fs');
const path = require('path');
const { resolveAgentPath } = require('./stateWatcher');

const SEOS_OUTPUT = '../agente de seo y product hunt/outputs';

function getLatestRawFiles() {
  const rawDir = resolveAgentPath(path.join(SEOS_OUTPUT, 'raw'));
  if (!fs.existsSync(rawDir)) return [];

  const files = fs.readdirSync(rawDir)
    .filter(f => (
      f.startsWith('raw_mercadolibre_') ||
      f.startsWith('raw_amazon_') ||
      f.startsWith('raw_temu_') ||
      f.startsWith('raw_alibaba_')
    ) && f.endsWith('.json'))
    .sort()
    .reverse();

  // Group by date (get the most recent set)
  if (files.length === 0) return [];
  const latestDate = files[0].match(/_(\d{8})\.json$/)?.[1];
  if (!latestDate) return [];

  return files.filter(f => f.includes(latestDate));
}

function loadTrendEnrichment() {
  const processedDir = resolveAgentPath(path.join(SEOS_OUTPUT, 'processed'));
  if (!fs.existsSync(processedDir)) return {};

  const trendFiles = fs.readdirSync(processedDir)
    .filter(f => f.startsWith('trend_analysis_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (trendFiles.length === 0) return {};

  try {
    const data = JSON.parse(fs.readFileSync(path.join(processedDir, trendFiles[0]), 'utf8'));
    return data.enrichment || {};
  } catch {
    return {};
  }
}

function normalizeTemuProduct(p, country, enrichment) {
  const enrichKey = `temu:${p.product_id || ''}`;
  const enrich = enrichment[enrichKey] || {};
  return {
    id: p.product_id || '',
    title: p.title,
    price: p.price || 0,
    currency: p.currency || 'USD',
    country,
    category: p.category_name || 'Sin categoria',
    soldQuantity: 0,
    soldText: p.sold_text || '',
    rating: p.rating || 0,
    reviews: p.reviews_count || 0,
    thumbnail: p.image_url || '',
    permalink: p.permalink || '',
    condition: 'new',
    seller: '',
    ranking: p.ranking || null,
    rankingLabel: p.ranking ? `#${p.ranking}` : '',
    source: 'temu',
    originalPrice: p.original_price || null,
    discountPct: p.discount_pct || null,
    isNew: enrich.isNew || false,
    priceChange: enrich.priceChange || null,
    oldPrice: enrich.oldPrice || null,
    rankingChange: enrich.rankingChange || null,
    oldRanking: enrich.oldRanking || null,
  };
}

function normalizeAlibabaProduct(p, enrichment) {
  const enrichKey = `alibaba:${p.product_id || ''}`;
  const enrich = enrichment[enrichKey] || {};
  return {
    id: p.product_id || '',
    title: p.title,
    price: p.price_min || 0,
    priceMin: p.price_min || null,
    priceMax: p.price_max || null,
    currency: p.currency || 'USD',
    country: 'GLOBAL',
    category: p.category_name || 'Sin categoria',
    soldQuantity: p.orders_count || 0,
    rating: p.rating || 0,
    reviews: p.reviews_count || 0,
    thumbnail: p.image_url || '',
    permalink: p.permalink || '',
    condition: 'new',
    seller: p.supplier_name || '',
    ranking: null,
    rankingLabel: '',
    source: 'alibaba',
    moq: p.moq || null,
    moqText: p.moq_text || null,
    supplierCountry: p.supplier_country || null,
    supplierVerified: p.supplier_verified || false,
    isNew: enrich.isNew || false,
    priceChange: enrich.priceChange || null,
    oldPrice: enrich.oldPrice || null,
    rankingChange: enrich.rankingChange || null,
    oldRanking: enrich.oldRanking || null,
  };
}

function loadAllProducts() {
  const files = getLatestRawFiles();
  const enrichment = loadTrendEnrichment();
  const allProducts = [];

  for (const file of files) {
    try {
      const filePath = resolveAgentPath(path.join(SEOS_OUTPUT, 'raw', file));
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const source = raw.source || detectSource(file);
      const country = raw.country || file.match(/_([A-Z]{2,6})_/)?.[1] || 'N/A';

      if (source === 'temu') {
        for (const p of (raw.products || [])) {
          allProducts.push(normalizeTemuProduct(p, country, enrichment));
        }
      } else if (source === 'alibaba') {
        for (const p of (raw.products || [])) {
          allProducts.push(normalizeAlibabaProduct(p, enrichment));
        }
      } else if (source === 'amazon') {
        for (const p of (raw.products || [])) {
          const enrichKey = `amazon:${p.asin || ''}`;
          const enrich = enrichment[enrichKey] || {};
          allProducts.push({
            id: p.asin || '',
            title: p.title,
            price: p.price || 0,
            currency: p.currency || 'USD',
            country,
            category: p.category_name || p.category || 'Sin categoria',
            soldQuantity: 0,
            rating: p.rating || 0,
            reviews: p.reviews_count || 0,
            thumbnail: p.image_url || '',
            permalink: p.url || '',
            condition: 'new',
            seller: p.seller_id || '',
            ranking: p.ranking || null,
            rankingLabel: p.ranking_label || '',
            source: 'amazon',
            isNew: enrich.isNew || false,
            priceChange: enrich.priceChange || null,
            oldPrice: enrich.oldPrice || null,
            rankingChange: enrich.rankingChange || null,
            oldRanking: enrich.oldRanking || null,
          });
        }
      } else {
        // mercadolibre
        for (const p of (raw.products || [])) {
          const enrichKey = `mercadolibre:${p.product_id || ''}`;
          const enrich = enrichment[enrichKey] || {};
          allProducts.push({
            id: p.product_id,
            title: p.title,
            price: p.price,
            currency: p.currency,
            country,
            category: p.category_name || 'Sin categoria',
            soldQuantity: p.sold_quantity || 0,
            rating: p.rating_average || 0,
            reviews: p.reviews_count || 0,
            thumbnail: p.thumbnail || '',
            permalink: p.permalink || '',
            condition: p.condition || 'new',
            seller: p.seller_id || '',
            ranking: p.ranking || null,
            rankingLabel: p.ranking_label || '',
            source: 'mercadolibre',
            isNew: enrich.isNew || false,
            priceChange: enrich.priceChange || null,
            oldPrice: enrich.oldPrice || null,
            rankingChange: enrich.rankingChange || null,
            oldRanking: enrich.oldRanking || null,
          });
        }
      }
    } catch {
      // Skip corrupted files
    }
  }

  return allProducts;
}

function detectSource(filename) {
  if (filename.includes('amazon')) return 'amazon';
  if (filename.includes('temu')) return 'temu';
  if (filename.includes('alibaba')) return 'alibaba';
  return 'mercadolibre';
}

function getProducts({ country, category, sort, source, page = 1, limit = 50 }) {
  let products = loadAllProducts();

  // Filter
  if (country && country !== 'all') {
    products = products.filter(p => p.country === country);
  }
  if (category && category !== 'all') {
    products = products.filter(p =>
      p.category.toLowerCase().includes(category.toLowerCase())
    );
  }
  if (source && source !== 'all') {
    products = products.filter(p => p.source === source);
  }

  // Sort
  if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'sold') products.sort((a, b) => b.soldQuantity - a.soldQuantity);
  else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
  else if (sort === 'ranking') products.sort((a, b) => (a.ranking || 999) - (b.ranking || 999));
  else products.sort((a, b) => b.soldQuantity - a.soldQuantity); // default: most sold

  // Paginate
  const total = products.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginated = products.slice(offset, offset + limit);

  return { products: paginated, total, page, totalPages, limit };
}

function getSummary() {
  const products = loadAllProducts();
  const byCountry = {};
  const byCategory = {};
  const bySource = {};

  const sourceCoverage = {}; // { source: { country: count } }

  for (const p of products) {
    byCountry[p.country] = (byCountry[p.country] || 0) + 1;
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    bySource[p.source] = (bySource[p.source] || 0) + 1;
    // Track real coverage: which source has data for which country
    if (!sourceCoverage[p.source]) sourceCoverage[p.source] = {};
    sourceCoverage[p.source][p.country] = (sourceCoverage[p.source][p.country] || 0) + 1;
  }

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Use actual file modification time for accurate "last search" timestamp
  const latestFiles = getLatestRawFiles();
  let lastSearchDate = null;
  let lastSearchDateTime = null;
  if (latestFiles.length > 0) {
    const filePath = resolveAgentPath(path.join(SEOS_OUTPUT, 'raw', latestFiles[0]));
    try {
      const stat = fs.statSync(filePath);
      lastSearchDateTime = stat.mtime.toISOString();
      lastSearchDate = stat.mtime.toISOString().split('T')[0];
    } catch {}
  }
  if (!lastSearchDate) {
    const dateStr = latestFiles[0]?.match(/_(\d{8})\.json$/)?.[1] || null;
    if (dateStr) {
      lastSearchDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
    }
  }

  // Calculate aggregate stats
  const ratings = products.filter(p => p.rating > 0).map(p => p.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
  const totalSold = products.reduce((sum, p) => sum + (p.soldQuantity || 0), 0);
  const withRanking = products.filter(p => p.ranking && p.ranking <= 10).length;
  const newProducts = products.filter(p => p.isNew).length;

  return {
    totalProducts: products.length,
    byCountry,
    bySource,
    sourceCoverage,
    topCategories,
    avgRating: Math.round(avgRating * 10) / 10,
    totalSold,
    productsWithRanking: withRanking,
    newProducts,
    lastUpdated: lastSearchDateTime || lastSearchDate,
    lastSearchDate: lastSearchDateTime || lastSearchDate,
  };
}

function getCountries() {
  const products = loadAllProducts();
  return [...new Set(products.map(p => p.country))].sort();
}

function getCategories() {
  const products = loadAllProducts();
  return [...new Set(products.map(p => p.category))].sort();
}

function getSources() {
  const products = loadAllProducts();
  return [...new Set(products.map(p => p.source))].sort();
}

function getTrends() {
  const processedDir = resolveAgentPath(path.join(SEOS_OUTPUT, 'processed'));
  if (!fs.existsSync(processedDir)) return null;

  const trendFiles = fs.readdirSync(processedDir)
    .filter(f => f.startsWith('trend_analysis_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (trendFiles.length === 0) return null;

  try {
    const data = JSON.parse(fs.readFileSync(path.join(processedDir, trendFiles[0]), 'utf8'));
    return {
      analysisDate: data.analysis_date,
      currentTotal: data.current_total,
      previousTotal: data.previous_total,
      summary: data.summary,
      newProducts: (data.new_products || []).slice(0, 20),
      droppedProducts: (data.dropped_products || []).slice(0, 20),
      priceChanges: (data.price_changes || []).slice(0, 15),
      rankingChanges: (data.ranking_changes || []).slice(0, 15),
      salesVelocity: (data.sales_velocity || []).slice(0, 10),
      categoryTrends: (data.category_trends || []).slice(0, 10),
    };
  } catch {
    return null;
  }
}

function getMarketStudy(filterCountry) {
  let products = loadAllProducts();

  // Filter by country if specified
  if (filterCountry && filterCountry !== 'all') {
    products = products.filter(p => p.country === filterCountry);
  }

  if (products.length === 0) return null;

  // Derive active sources from actual data (no hardcoded temu/alibaba)
  const SOURCES = [...new Set(products.map(p => p.source))].sort();
  const SOURCE_LABELS = { mercadolibre: 'MercadoLibre', amazon: 'Amazon', temu: 'Temu', alibaba: 'Alibaba' };

  // 1. Category Dominance: categories × sources (stacked bar)
  const catSourceMap = {};
  for (const p of products) {
    const cat = p.category || 'Otros';
    if (!catSourceMap[cat]) catSourceMap[cat] = {};
    catSourceMap[cat][p.source] = (catSourceMap[cat][p.source] || 0) + 1;
  }

  const dominance = Object.entries(catSourceMap)
    .map(([cat, sources]) => {
      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      return { category: cat, ...sources, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  // 2. Geo Distribution: countries × sources (grouped bar)
  const geoMap = {};
  for (const p of products) {
    const c = p.country;
    if (!geoMap[c]) geoMap[c] = {};
    geoMap[c][p.source] = (geoMap[c][p.source] || 0) + 1;
  }

  const geoDistribution = Object.entries(geoMap)
    .map(([country, sources]) => ({ country, ...sources }));

  // 3. Price Comparison: avg price per category × source
  const priceAccum = {};
  for (const p of products) {
    if (!p.price || p.price <= 0) continue;
    const cat = p.category || 'Otros';
    const key = `${cat}||${p.source}`;
    if (!priceAccum[key]) priceAccum[key] = { sum: 0, count: 0 };
    priceAccum[key].sum += p.price;
    priceAccum[key].count += 1;
  }

  const priceByCat = {};
  for (const [key, val] of Object.entries(priceAccum)) {
    const [cat, source] = key.split('||');
    if (!priceByCat[cat]) priceByCat[cat] = {};
    priceByCat[cat][source] = Math.round(val.sum / val.count * 100) / 100;
  }

  const priceComparison = Object.entries(priceByCat)
    .map(([cat, sources]) => ({ category: cat, ...sources }))
    .sort((a, b) => {
      const totalA = SOURCES.reduce((s, src) => s + (a[src] || 0), 0);
      const totalB = SOURCES.reduce((s, src) => s + (b[src] || 0), 0);
      return totalB - totalA;
    })
    .slice(0, 10);

  // 4. Source Distribution: total products per source (pie chart)
  const sourceDistribution = SOURCES
    .map(src => ({
      name: SOURCE_LABELS[src] || src,
      value: products.filter(p => p.source === src).length,
      source: src,
    }))
    .filter(s => s.value > 0);

  // 5. Coverage Map: country × source (boolean matrix)
  const allCountries = [...new Set(products.map(p => p.country))].sort();
  const coverageMap = allCountries.map(country => {
    const row = { country };
    for (const src of SOURCES) {
      row[src] = products.some(p => p.country === country && p.source === src);
    }
    return row;
  });

  // 6. Top Categories Treemap: size = count, includes dominant source
  const topCategories = Object.entries(catSourceMap)
    .map(([cat, sources]) => {
      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      const dominant = Object.entries(sources).sort((a, b) => b[1] - a[1])[0];
      const pricesInCat = products.filter(p => p.category === cat && p.price > 0).map(p => p.price);
      const avgPrice = pricesInCat.length > 0
        ? Math.round(pricesInCat.reduce((a, b) => a + b, 0) / pricesInCat.length * 100) / 100
        : 0;
      return {
        name: cat,
        size: total,
        dominantSource: dominant?.[0] || 'unknown',
        avgPrice,
      };
    })
    .sort((a, b) => b.size - a.size)
    .slice(0, 15);

  return {
    dominance,
    geoDistribution,
    priceComparison,
    sourceDistribution,
    coverageMap,
    topCategories,
    sources: SOURCES.filter(s => products.some(p => p.source === s)),
    sourceLabels: SOURCE_LABELS,
    totalProducts: products.length,
  };
}

function getReport() {
  const processedDir = resolveAgentPath(path.join(SEOS_OUTPUT, 'processed'));
  if (!fs.existsSync(processedDir)) return null;

  const htmlFiles = fs.readdirSync(processedDir)
    .filter(f => f.endsWith('.html'))
    .sort()
    .reverse();

  if (htmlFiles.length === 0) return null;
  return fs.readFileSync(path.join(processedDir, htmlFiles[0]), 'utf8');
}

module.exports = { getProducts, getSummary, getCountries, getCategories, getSources, getTrends, getMarketStudy, getReport };
