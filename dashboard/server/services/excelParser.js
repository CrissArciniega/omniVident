const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { resolveAgentPath } = require('./stateWatcher');

const RRSS_OUTPUT = '../agente contenido y rrss/output';

let cachedWorkbook = null;
let cachedMtime = null;

function getExcelPath() {
  return resolveAgentPath(path.join(RRSS_OUTPUT, 'MegaMayorista_SEO_RRSS.xlsx'));
}

function loadWorkbook() {
  const excelPath = getExcelPath();
  if (!fs.existsSync(excelPath)) return null;

  const stat = fs.statSync(excelPath);
  const mtime = stat.mtimeMs;

  if (cachedWorkbook && cachedMtime === mtime) return cachedWorkbook;

  cachedWorkbook = XLSX.readFile(excelPath);
  cachedMtime = mtime;
  return cachedWorkbook;
}

function getSheetNames() {
  const wb = loadWorkbook();
  if (!wb) return [];
  return wb.SheetNames;
}

function getSheetData(sheetName) {
  const wb = loadWorkbook();
  if (!wb) return null;

  const sheet = wb.Sheets[sheetName];
  if (!sheet) return null;

  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function getKeywords() {
  // 1. Try phase2 ranked keywords first
  const keywordsPath = resolveAgentPath(
    path.join(RRSS_OUTPUT, 'phase2_ranked', 'top_keywords.json')
  );
  if (fs.existsSync(keywordsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(keywordsPath, 'utf8'));
      if (data && data.length > 0) return data;
    } catch {}
  }

  // 2. Fallback: extract keywords from tendencias_actuales.json
  const trends = getTrends();
  if (trends && trends.all_keywords_ranked) {
    return trends.all_keywords_ranked.slice(0, 30).map((kw, i) => ({
      rank: i + 1,
      keyword: kw.keyword,
      weighted_total: kw.count * 15 || 50,
      source_count: kw.sources?.length || 1,
      sources_found_in: kw.sources || [],
      trend_data: { direction: 'rising' },
    }));
  }

  // 3. Fallback: extract from Excel "Tendencias Actuales" sheet
  const sheetData = getSheetData('Tendencias Actuales');
  if (sheetData && sheetData.length > 0) {
    return sheetData.slice(0, 30).map((row, i) => ({
      rank: row.ranking || i + 1,
      keyword: row.keyword || row.Keyword || Object.values(row)[1] || '',
      weighted_total: 80 - i * 2,
      source_count: row.apariciones || 1,
      sources_found_in: row.fuentes ? row.fuentes.split(' + ') : [],
      trend_data: { direction: 'rising' },
    }));
  }

  return [];
}

function getTrends() {
  const trendsPath = resolveAgentPath(
    path.join(RRSS_OUTPUT, 'tendencias_actuales.json')
  );
  if (!fs.existsSync(trendsPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(trendsPath, 'utf8'));
  } catch {
    return null;
  }
}

function getLastModified() {
  const excelPath = getExcelPath();
  if (!fs.existsSync(excelPath)) return null;
  return fs.statSync(excelPath).mtime.toISOString();
}

module.exports = { getSheetNames, getSheetData, getKeywords, getTrends, getLastModified };
