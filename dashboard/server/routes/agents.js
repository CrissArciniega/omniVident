const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getAgentState } = require('../services/stateWatcher');
const { runAgent, isRunning, getRunningInfo, getLastOutput } = require('../services/agentRunner');

const router = express.Router();

// List all agents with latest execution
router.get('/', auth, async (req, res) => {
  try {
    const [agents] = await pool.query('SELECT * FROM agents WHERE is_active = TRUE ORDER BY id');

    const result = await Promise.all(agents.map(async (agent) => {
      const [executions] = await pool.query(
        'SELECT * FROM executions WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1',
        [agent.id]
      );
      const liveState = getAgentState(agent.slug, agent.state_file_path);

      return {
        ...agent,
        lastExecution: executions[0] || null,
        liveState,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('[Agents] Error list:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Agent detail with execution history
router.get('/:slug', auth, async (req, res) => {
  try {
    const [agents] = await pool.query('SELECT * FROM agents WHERE slug = ?', [req.params.slug]);
    if (agents.length === 0) return res.status(404).json({ error: 'Agente no encontrado' });

    const agent = agents[0];
    const [executions] = await pool.query(
      'SELECT * FROM executions WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20',
      [agent.id]
    );
    const liveState = getAgentState(agent.slug, agent.state_file_path);

    res.json({ ...agent, executions, liveState });
  } catch (err) {
    console.error('[Agents] Error detail:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Live state only (for polling)
router.get('/:slug/status', auth, async (req, res) => {
  try {
    const [agents] = await pool.query('SELECT slug, state_file_path FROM agents WHERE slug = ?', [req.params.slug]);
    if (agents.length === 0) return res.status(404).json({ error: 'Agente no encontrado' });

    const state = getAgentState(agents[0].slug, agents[0].state_file_path);
    res.json(state);
  } catch (err) {
    console.error('[Agents] Error status:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Update agent settings
router.put('/:slug', auth, async (req, res) => {
  try {
    const { slug } = req.params;
    const [agents] = await pool.query('SELECT * FROM agents WHERE slug = ?', [slug]);
    if (agents.length === 0) return res.status(404).json({ error: 'Agente no encontrado' });

    const { name, description, schedule_description, schedule_cron, icon, custom_image } = req.body;
    const updates = [];
    const values = [];

    if (name && name.trim()) { updates.push('name = ?'); values.push(name.trim()); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description.trim()); }
    if (schedule_description !== undefined) { updates.push('schedule_description = ?'); values.push(schedule_description); }
    if (schedule_cron !== undefined) { updates.push('schedule_cron = ?'); values.push(schedule_cron); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
    if (custom_image !== undefined) {
      // null to clear, or base64 data URL string (limit ~1.5MB)
      if (custom_image && custom_image.length > 1500000) {
        return res.status(400).json({ error: 'Imagen demasiado grande (max 1MB)' });
      }
      updates.push('custom_image = ?');
      values.push(custom_image);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

    values.push(slug);
    await pool.query(`UPDATE agents SET ${updates.join(', ')} WHERE slug = ?`, values);

    // Refresh cron jobs if schedule changed
    if (schedule_cron !== undefined && req.app.locals.setupCronJobs) {
      req.app.locals.setupCronJobs();
    }

    const [updated] = await pool.query('SELECT * FROM agents WHERE slug = ?', [slug]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[Agents] Error update:', err);
    res.status(500).json({ error: 'Error actualizando agente' });
  }
});

// Run agent manually
router.post('/:slug/run', auth, async (req, res) => {
  try {
    const { slug } = req.params;
    const [agents] = await pool.query('SELECT * FROM agents WHERE slug = ?', [slug]);
    if (agents.length === 0) return res.status(404).json({ error: 'Agente no encontrado' });

    if (isRunning(slug)) {
      return res.json({ status: 'already_running', ...getRunningInfo(slug) });
    }

    const result = await runAgent(slug);
    if (result.error) return res.status(400).json(result);

    res.json(result);
  } catch (err) {
    console.error('[Agents] Error run:', err);
    res.status(500).json({ error: 'Error al iniciar la busqueda: ' + err.message });
  }
});

// Real-time progress for agent execution
router.get('/:slug/progress', auth, (req, res) => {
  const { slug } = req.params;
  const { resolveAgentPath } = require('../services/stateWatcher');
  const fs = require('fs');
  const path = require('path');

  let agentDir = '';
  if (slug === 'content-rrss') agentDir = resolveAgentPath('../agente contenido y rrss');
  else if (slug === 'market-research') agentDir = resolveAgentPath('../agente de seo y product hunt');

  if (!agentDir) return res.json({ percent: 0, message: '', detail: '', active: false });

  // content-rrss uses 'output/', market-research uses 'outputs/'
  const outputFolder = slug === 'market-research' ? 'outputs' : 'output';
  const progressFile = path.join(agentDir, outputFolder, 'agent_progress.json');
  try {
    if (fs.existsSync(progressFile)) {
      const data = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      // If progress is stale (> 5 min old), mark inactive
      if (data.timestamp && Date.now() - data.timestamp > 300000) {
        data.active = false;
      }
      return res.json(data);
    }
  } catch {}
  res.json({ percent: 0, message: '', detail: '', active: false });
});

// Check if agent is running + last output info
router.get('/:slug/running', auth, (req, res) => {
  const info = getRunningInfo(req.params.slug);
  const last = getLastOutput(req.params.slug);
  res.json({
    running: !!info,
    ...(info || {}),
    lastOutput: last,
  });
});

module.exports = router;
