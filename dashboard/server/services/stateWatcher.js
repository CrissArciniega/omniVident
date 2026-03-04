const fs = require('fs');
const path = require('path');

const DASHBOARD_ROOT = path.join(__dirname, '..', '..');

function resolveAgentPath(relativePath) {
  return path.resolve(DASHBOARD_ROOT, relativePath);
}

function readStateFile(filePath) {
  try {
    const resolved = resolveAgentPath(filePath);
    if (!fs.existsSync(resolved)) return null;
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get the most recent modification date from a list of file paths.
 */
function getNewestFileDate(filePaths) {
  let newest = null;
  for (const fp of filePaths) {
    try {
      if (fs.existsSync(fp)) {
        const stat = fs.statSync(fp);
        if (!newest || stat.mtime > newest) {
          newest = stat.mtime;
        }
      }
    } catch {
      // skip
    }
  }
  return newest;
}

function normalizeMarketState(raw) {
  if (!raw) return { status: 'sin datos', lastRun: null, details: null };

  const agentStatuses = raw.agents_status || {};
  const hasRunning = Object.values(agentStatuses).some(s => s === 'running');
  const hasFailed = Object.values(agentStatuses).some(s => s === 'failed');

  let status = 'pendiente';
  if (raw.last_status === 'success') status = 'completado';
  else if (raw.last_status === 'failed' || hasFailed) status = 'error';
  else if (hasRunning) status = 'ejecutando';

  // Also check actual raw output file dates
  const rawDir = resolveAgentPath('../agente de seo y product hunt/outputs/raw');
  let lastRun = raw.last_run;
  try {
    if (fs.existsSync(rawDir)) {
      const files = fs.readdirSync(rawDir)
        .filter(f => (f.startsWith('raw_mercadolibre_') || f.startsWith('raw_amazon_') || f.startsWith('raw_temu_') || f.startsWith('raw_alibaba_')) && f.endsWith('.json'))
        .map(f => path.join(rawDir, f));
      const newest = getNewestFileDate(files);
      if (newest) {
        const dateStr = newest.toISOString();
        if (!lastRun || new Date(dateStr) > new Date(lastRun)) {
          lastRun = dateStr;
          if (status === 'pendiente') status = 'completado';
        }
      }
    }
  } catch { /* ignore */ }

  return {
    status,
    lastRun,
    productsPublished: raw.products_published || 0,
    errors: raw.errors || [],
    agents: agentStatuses,
  };
}

function normalizeContentState(raw) {
  // ── Check actual output files for the real last run date ──
  // run_agent.js does NOT update pipeline_state.json, so we derive
  // the real status from the output files themselves.
  const outputDir = resolveAgentPath('../agente contenido y rrss/output');
  const outputFiles = [
    path.join(outputDir, 'tendencias_actuales.json'),
    path.join(outputDir, 'MegaMayorista_SEO_RRSS.xlsx'),
  ];
  const newestOutputDate = getNewestFileDate(outputFiles);

  // Phases from pipeline_state.json (may be stale)
  let phaseList = [];
  if (raw && raw.phases) {
    phaseList = Object.entries(raw.phases).map(([key, val]) => ({
      name: key,
      status: val.status || 'pending',
      startedAt: val.started_at,
      completedAt: val.completed_at,
      duration: val.duration_seconds,
      outputFile: val.output_file,
      errors: val.errors || [],
    }));
  }

  // Derive status: if output files are newer than pipeline_state, the compilation ran OK
  let derivedStatus = 'pendiente';
  let lastRun = null;

  if (raw) {
    derivedStatus = raw.status === 'COMPLETED' ? 'completado'
      : raw.status === 'FAILED' ? 'error'
      : raw.status === 'RUNNING' ? 'ejecutando'
      : 'pendiente';
    lastRun = raw.started_at || raw.completed_at || null;
  }

  // If output files exist and are newer, override with their date
  if (newestOutputDate) {
    const pipelineDate = raw?.started_at ? new Date(raw.started_at) : null;
    if (!pipelineDate || newestOutputDate > pipelineDate) {
      lastRun = newestOutputDate.toISOString();
      derivedStatus = 'completado';
    }
  }

  // Count how many content_packs exist
  let contentPackCount = 0;
  const packsDir = path.join(outputDir, 'content_packs');
  try {
    if (fs.existsSync(packsDir)) {
      contentPackCount = fs.readdirSync(packsDir).filter(f =>
        fs.statSync(path.join(packsDir, f)).isDirectory()
      ).length;
    }
  } catch { /* ignore */ }

  return {
    status: derivedStatus,
    lastRun,
    completedAt: raw?.completed_at || (newestOutputDate ? newestOutputDate.toISOString() : null),
    currentPhase: raw?.current_phase,
    runId: raw?.pipeline_run_id,
    phases: phaseList,
    contentPackCount,
  };
}

function getAgentState(slug, stateFilePath) {
  const raw = readStateFile(stateFilePath);
  if (slug === 'market-research') return normalizeMarketState(raw);
  if (slug === 'content-rrss') return normalizeContentState(raw);
  return { status: 'desconocido', raw };
}

module.exports = { getAgentState, readStateFile, resolveAgentPath };
