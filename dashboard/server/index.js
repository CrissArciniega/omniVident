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

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/content', contentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Ejecucion automatica: Lunes, Miercoles, Viernes a las 7:00 AM ───
cron.schedule('0 7 * * 1,3,5', async () => {
  console.log(`[Cron] ${new Date().toISOString()} — Iniciando busqueda automatica`);

  // Ejecutar agente de mercado
  if (!isRunning('market-research')) {
    try {
      await runAgent('market-research');
      console.log('[Cron] Agente de mercado iniciado');
    } catch (err) {
      console.error('[Cron] Error iniciando agente de mercado:', err.message);
    }
  }

  // Esperar 30s y luego ejecutar agente de contenido
  setTimeout(async () => {
    if (!isRunning('content-rrss')) {
      try {
        await runAgent('content-rrss');
        console.log('[Cron] Agente de contenido iniciado');
      } catch (err) {
        console.error('[Cron] Error iniciando agente de contenido:', err.message);
      }
    }
  }, 30000);
}, {
  timezone: 'America/Guayaquil'
});

console.log('[Cron] Busqueda automatica programada: Lun/Mie/Vie 7:00 AM (Ecuador)');

app.listen(PORT, () => {
  console.log(`[Server] Mission Control corriendo en http://localhost:${PORT}`);
});
