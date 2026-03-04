require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const marketRoutes = require('./routes/market');
const contentRoutes = require('./routes/content');
const { runAgent, isRunning } = require('./services/agentRunner');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'], credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/content', contentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend build (production mode)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Ejecucion automatica dinamica desde DB ───
const pool = require('./config/db');
const activeCronJobs = {};

async function setupCronJobs() {
  // Stop existing jobs
  for (const [slug, job] of Object.entries(activeCronJobs)) {
    job.stop();
    delete activeCronJobs[slug];
  }

  try {
    const [agents] = await pool.query('SELECT slug, schedule_cron, schedule_description FROM agents WHERE is_active = TRUE');
    for (const agent of agents) {
      const cronExpr = agent.schedule_cron || '0 7 * * 1,3,5';
      if (!cron.validate(cronExpr)) {
        console.log(`[Cron] Invalid cron expression for ${agent.slug}: ${cronExpr}, skipping`);
        continue;
      }
      activeCronJobs[agent.slug] = cron.schedule(cronExpr, async () => {
        console.log(`[Cron] ${new Date().toISOString()} — Ejecutando ${agent.slug}`);
        if (!isRunning(agent.slug)) {
          try {
            await runAgent(agent.slug);
            console.log(`[Cron] ${agent.slug} iniciado`);
          } catch (err) {
            console.error(`[Cron] Error iniciando ${agent.slug}:`, err.message);
          }
        }
      }, { timezone: 'America/Guayaquil' });
      console.log(`[Cron] ${agent.slug}: "${cronExpr}" (${agent.schedule_description || 'sin descripcion'})`);
    }
  } catch (err) {
    console.error('[Cron] Error setting up jobs:', err.message);
    // Fallback to hardcoded schedule
    activeCronJobs['fallback'] = cron.schedule('0 7 * * 1,3,5', async () => {
      if (!isRunning('market-research')) await runAgent('market-research').catch(() => {});
      setTimeout(async () => {
        if (!isRunning('content-rrss')) await runAgent('content-rrss').catch(() => {});
      }, 30000);
    }, { timezone: 'America/Guayaquil' });
    console.log('[Cron] Fallback: Lun/Mie/Vie 7:00 AM (Ecuador)');
  }
}

// Export for re-init when agent settings change
app.locals.setupCronJobs = setupCronJobs;
setupCronJobs();

app.listen(PORT, () => {
  console.log(`[Server] Mission Control corriendo en http://localhost:${PORT}`);
});
