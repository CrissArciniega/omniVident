const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getAllowedSlugs } = require('../config/permissions');
const { getAgentState } = require('../services/stateWatcher');
const { runAgent, isRunning, getRunningInfo, getLastOutput } = require('../services/agentRunner');

const router = express.Router();

// List all agents with latest execution (merged with per-user visual settings)
router.get('/', auth, async (req, res) => {
  try {
    const [agents] = await pool.query('SELECT * FROM agents WHERE is_active = TRUE ORDER BY id');
    const allowed = getAllowedSlugs(req.user.role);
    const filtered = agents.filter(a => allowed.includes(a.slug));

    // Get per-user overrides
    const [userSettings] = await pool.query(
      'SELECT * FROM user_agent_settings WHERE user_id = ?',
      [req.user.id]
    );
    const settingsMap = {};
    userSettings.forEach(s => { settingsMap[s.agent_slug] = s; });

    const result = await Promise.all(filtered.map(async (agent) => {
      const [executions] = await pool.query(
        'SELECT * FROM executions WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1',
        [agent.id]
      );
      const liveState = getAgentState(agent.slug, agent.state_file_path);

      // Merge user overrides on top of base agent
      const ov = settingsMap[agent.slug];
      return {
        ...agent,
        name: ov?.custom_name || agent.name,
        description: ov?.custom_description ?? agent.description,
        icon: ov?.custom_icon || agent.icon,
        custom_image: ov?.custom_image !== undefined ? ov.custom_image : agent.custom_image,
        schedule_cron: ov?.schedule_cron || agent.schedule_cron,
        schedule_description: ov?.schedule_description || agent.schedule_description,
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

// Update agent settings (everything is per-user)
router.put('/:slug', auth, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;
    const [agents] = await pool.query('SELECT * FROM agents WHERE slug = ?', [slug]);
    if (agents.length === 0) return res.status(404).json({ error: 'Agente no encontrado' });

    const { name, description, schedule_description, schedule_cron, icon, custom_image } = req.body;

    if (custom_image && custom_image.length > 1500000) {
      return res.status(400).json({ error: 'Imagen demasiado grande (max 1MB)' });
    }

    // UPSERT all settings into user_agent_settings
    const [existing] = await pool.query(
      'SELECT id FROM user_agent_settings WHERE user_id = ? AND agent_slug = ?',
      [userId, slug]
    );

    if (existing.length > 0) {
      const uUpdates = [];
      const uValues = [];
      if (name !== undefined) { uUpdates.push('custom_name = ?'); uValues.push(name.trim() || null); }
      if (description !== undefined) { uUpdates.push('custom_description = ?'); uValues.push(description.trim()); }
      if (icon !== undefined) { uUpdates.push('custom_icon = ?'); uValues.push(icon); }
      if (custom_image !== undefined) { uUpdates.push('custom_image = ?'); uValues.push(custom_image); }
      if (schedule_cron !== undefined) { uUpdates.push('schedule_cron = ?'); uValues.push(schedule_cron); }
      if (schedule_description !== undefined) { uUpdates.push('schedule_description = ?'); uValues.push(schedule_description); }
      if (uUpdates.length > 0) {
        uValues.push(existing[0].id);
        await pool.query(`UPDATE user_agent_settings SET ${uUpdates.join(', ')} WHERE id = ?`, uValues);
      }
    } else {
      await pool.query(
        `INSERT INTO user_agent_settings
         (user_id, agent_slug, custom_name, custom_description, custom_icon, custom_image, schedule_cron, schedule_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, slug, name?.trim() || null, description?.trim() ?? null, icon || null, custom_image ?? null, schedule_cron ?? null, schedule_description ?? null]
      );
    }

    // Refresh cron jobs if schedule changed
    if (schedule_cron !== undefined && req.app.locals.setupCronJobs) {
      req.app.locals.setupCronJobs();
    }

    // Return merged agent for this user
    const [updatedAgent] = await pool.query('SELECT * FROM agents WHERE slug = ?', [slug]);
    const [userOv] = await pool.query(
      'SELECT * FROM user_agent_settings WHERE user_id = ? AND agent_slug = ?',
      [userId, slug]
    );
    const base = updatedAgent[0];
    const ov = userOv[0];
    res.json({
      ...base,
      name: ov?.custom_name || base.name,
      description: ov?.custom_description ?? base.description,
      icon: ov?.custom_icon || base.icon,
      custom_image: ov?.custom_image !== undefined ? ov.custom_image : base.custom_image,
      schedule_cron: ov?.schedule_cron || base.schedule_cron,
      schedule_description: ov?.schedule_description || base.schedule_description,
    });
  } catch (err) {
    console.error('[Agents] Error update:', err);
    res.status(500).json({ error: 'Error actualizando agente' });
  }
});

// Run agent manually
router.post('/:slug/run', auth, auth.requireAgentAccess(), async (req, res) => {
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
