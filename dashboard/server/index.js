require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const marketRoutes = require('./routes/market');
const contentRoutes = require('./routes/content');
const userRoutes = require('./routes/users');
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
app.use('/api/users', userRoutes);

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
  for (const [key, job] of Object.entries(activeCronJobs)) {
    job.stop();
    delete activeCronJobs[key];
  }

  try {
    const [agents] = await pool.query('SELECT slug, schedule_cron, schedule_description FROM agents WHERE is_active = TRUE');
    // Collect per-user schedules
    const [userSchedules] = await pool.query(
      'SELECT uas.agent_slug, uas.schedule_cron, u.name as user_name, u.id as user_id FROM user_agent_settings uas JOIN users u ON u.id = uas.user_id WHERE uas.schedule_cron IS NOT NULL AND u.active = TRUE'
    );

    for (const agent of agents) {
      // Gather all unique cron expressions for this agent
      const cronSet = new Map(); // cronExpr → label (for logging)
      const baseCron = agent.schedule_cron || '0 7 * * 1,3,5';

      // User-specific schedules for this agent
      const userCrons = userSchedules.filter(us => us.agent_slug === agent.slug);
      if (userCrons.length > 0) {
        for (const uc of userCrons) {
          if (uc.schedule_cron && cron.validate(uc.schedule_cron)) {
            const label = cronSet.get(uc.schedule_cron);
            cronSet.set(uc.schedule_cron, label ? `${label}, ${uc.user_name}` : uc.user_name);
          }
        }
      } else {
        // No user has customized → use base agent schedule
        cronSet.set(baseCron, 'default');
      }

      // Create a cron job for each unique expression
      for (const [cronExpr, label] of cronSet) {
        if (!cron.validate(cronExpr)) {
          console.log(`[Cron] Invalid: ${agent.slug} "${cronExpr}" (${label}), skipping`);
          continue;
        }
        const jobKey = `${agent.slug}__${cronExpr}`;
        activeCronJobs[jobKey] = cron.schedule(cronExpr, async () => {
          console.log(`[Cron] ${new Date().toISOString()} — Ejecutando ${agent.slug} (${label})`);
          if (!isRunning(agent.slug)) {
            try {
              await runAgent(agent.slug);
              console.log(`[Cron] ${agent.slug} iniciado`);
            } catch (err) {
              console.error(`[Cron] Error iniciando ${agent.slug}:`, err.message);
            }
          } else {
            console.log(`[Cron] ${agent.slug} ya en ejecucion, omitiendo`);
          }
        }, { timezone: 'America/Guayaquil' });
        console.log(`[Cron] ${agent.slug}: "${cronExpr}" (${label})`);
      }
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
