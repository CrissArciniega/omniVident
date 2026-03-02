const fs = require('fs');
const path = require('path');
const { resolveAgentPath } = require('./stateWatcher');

const SEOS_OUTPUT = '../agente de seo y product hunt/outputs';

function getLatestRawFiles() {
  const rawDir = resolveAgentPath(path.join(SEOS_OUTPUT, 'raw'));
  if (!fs.existsSync(rawDir)) return [];

  const files = fs.readdirSync(rawDir)
    .filter(f => f.startsWith('raw_mercadolibre_') && f.endsWith('.json'))
    .sort()
    .reverse();

  // Group by date (get the most recent set)
  if (files.length === 0) return [];
  const latestDate = files[0].match(/_(\d{8})\.json$/)?.[1];
  if (!latestDate) return [];

  return files.filter(f => f.includes(latestDate));
}

function loadAllProducts() {
  const files = getLatestRawFiles();
  const allProducts = [];

  for (const file of files) {
    try {
      const filePath = resolveAgentPath(path.join(SEOS_OUTPUT, 'raw', file));
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const country = raw.country || file.match(/_([A-Z]{2})_/)?.[1] || 'N/A';

      for (const p of (raw.products || [])) {
        allProducts.push({
          id: p.product_id,
          title: p.title,
          price: p.price,
          currency: p.currency,
          country,
          category: p.category_name || 'Sin categoría',
          soldQuantity: p.sold_quantity || 0,
          rating: p.rating_average || 0,
          reviews: p.reviews_count || 0,
          thumbnail: p.thumbnail || '',
          permalink: p.permalink || '',
          condition: p.condition || 'new',
        });
      }
    } catch {
      // Skip corrupted files
    }
  }

  return allProducts;
}

function getProducts({ country, category, sort, page = 1, limit = 50 }) {
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

  // Sort
  if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'sold') products.sort((a, b) => b.soldQuantity - a.soldQuantity);
  else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
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

  for (const p of products) {
    byCountry[p.country] = (byCountry[p.country] || 0) + 1;
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
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

  return {
    totalProducts: products.length,
    byCountry,
    topCategories,
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

module.exports = { getProducts, getSummary, getCountries, getCategories, getReport };
