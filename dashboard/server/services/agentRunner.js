const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { resolveAgentPath } = require('./stateWatcher');

// Track running processes
const runningProcesses = {};

// Store last output for each agent (for debugging via API)
const lastOutput = {};

/**
 * Detect working Python command on this machine.
 * Tries 'py', 'python', 'python3' in that order.
 * Returns null if none works.
 */
function detectPython() {
  const candidates = process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      const result = execSync(`${cmd} --version 2>&1`, {
        timeout: 5000,
        encoding: 'utf8',
        windowsHide: true,
      });
      if (result && result.toLowerCase().includes('python 3')) {
        console.log(`[AgentRunner] Python detectado: ${cmd} -> ${result.trim()}`);
        return cmd;
      }
    } catch {
      // Try next
    }
  }
  return null;
}

function getAgentCommand(slug) {
  if (slug === 'market-research') {
    const pythonCmd = detectPython();
    if (!pythonCmd) {
      return {
        error: 'Python no esta instalado. Instala Python 3.10+ desde https://python.org (marca "Add to PATH" durante la instalacion). Luego ejecuta: cd "agente de seo y product hunt" && pip install -r requirements.txt',
      };
    }
    const cwd = resolveAgentPath('../agente de seo y product hunt');
    if (!fs.existsSync(cwd)) {
      return { error: `Directorio del agente no encontrado: ${cwd}` };
    }
    // Fase 1: ML + Amazon en PARALELO (run_collectors.py)
    // Fase 2: Trend analyzer → Report (secuencial)
    return {
      cwd,
      command: pythonCmd,
      args: ['scripts/run_collectors.py'],
      postCommands: [
        { command: pythonCmd, args: ['scripts/trend_analyzer.py'] },
        { command: pythonCmd, args: ['scripts/generate_report.py', '--no-open'] },
      ],
    };
  }

  if (slug === 'content-rrss') {
    const cwd = resolveAgentPath('../agente contenido y rrss');
    if (!fs.existsSync(cwd)) {
      return { error: `Directorio del agente no encontrado: ${cwd}` };
    }
    return { cwd, command: 'node', args: ['run_agent.js'] };
  }

  return null;
}

async function runAgent(slug) {
  if (runningProcesses[slug]) {
    return { error: 'El agente ya esta en busqueda', running: true };
  }

  const cmd = getAgentCommand(slug);
  if (!cmd) return { error: 'Agente no encontrado' };
  if (cmd.error) return { error: cmd.error };

  // Get agent id from DB
  const [agents] = await pool.query('SELECT id FROM agents WHERE slug = ?', [slug]);
  if (agents.length === 0) return { error: 'Agente no registrado en DB' };
  const agentId = agents[0].id;

  // Create execution record
  const [result] = await pool.query(
    'INSERT INTO executions (agent_id, status, started_at) VALUES (?, ?, NOW())',
    [agentId, 'running']
  );
  const executionId = result.insertId;

  const startTime = Date.now();
  let stdout = '';
  let stderr = '';

  console.log(`[AgentRunner] Iniciando: ${cmd.command} ${cmd.args.join(' ')}`);
  console.log(`[AgentRunner] Directorio: ${cmd.cwd}`);

  let proc;
  try {
    proc = spawn(cmd.command, cmd.args, {
      cwd: cmd.cwd,
      env: { ...process.env },
      shell: true,
      windowsHide: true,
    });
  } catch (spawnErr) {
    console.error(`[AgentRunner] Error al iniciar ${slug}:`, spawnErr.message);

    await pool.query(
      `UPDATE executions SET status = 'failed', completed_at = NOW(), duration_seconds = 0, errors = ? WHERE id = ?`,
      [JSON.stringify([spawnErr.message]), executionId]
    );

    lastOutput[slug] = {
      exitCode: -1,
      stdout: '',
      stderr: spawnErr.message,
      duration: 0,
      finishedAt: new Date().toISOString(),
    };

    return { error: `Error al iniciar el agente: ${spawnErr.message}` };
  }

  runningProcesses[slug] = { proc, executionId, startTime };

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    stdout += text;
    text.split('\n').filter(l => l.trim()).forEach(l =>
      console.log(`[${slug}] ${l}`)
    );
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    stderr += text;
    text.split('\n').filter(l => l.trim()).forEach(l =>
      console.log(`[${slug}:err] ${l}`)
    );
  });

  proc.on('error', async (err) => {
    console.error(`[AgentRunner] Spawn error ${slug}:`, err.message);
    stderr += `\nError: ${err.message}`;

    const duration = Math.round((Date.now() - startTime) / 1000);
    try {
      await pool.query(
        `UPDATE executions SET status = 'failed', completed_at = NOW(), duration_seconds = ?, errors = ? WHERE id = ?`,
        [duration, JSON.stringify([err.message]), executionId]
      );
    } catch (dbErr) {
      console.error('[AgentRunner] Error updating DB:', dbErr);
    }

    lastOutput[slug] = {
      exitCode: -1,
      stdout: stdout.slice(-2000),
      stderr: stderr.slice(-2000),
      duration,
      finishedAt: new Date().toISOString(),
    };

    delete runningProcesses[slug];
  });

  proc.on('close', async (code) => {
    // If main command succeeded and there are postCommands, run them sequentially
    const postCommands = cmd.postCommands || (cmd.postCommand ? [cmd.postCommand] : []);
    if (code === 0 && postCommands.length > 0) {
      for (let i = 0; i < postCommands.length; i++) {
        const postCmd = postCommands[i];
        const stepLabel = `post ${i + 1}/${postCommands.length}`;
        console.log(`[AgentRunner] ${slug}: Ejecutando ${stepLabel}: ${postCmd.command} ${postCmd.args.join(' ')}`);
        try {
          const postProc = spawn(postCmd.command, postCmd.args, {
            cwd: cmd.cwd,
            env: { ...process.env },
            shell: true,
            windowsHide: true,
          });
          postProc.stdout.on('data', (d) => {
            const txt = d.toString();
            stdout += txt;
            txt.split('\n').filter(l => l.trim()).forEach(l => console.log(`[${slug}:${stepLabel}] ${l}`));
          });
          postProc.stderr.on('data', (d) => {
            const txt = d.toString();
            txt.split('\n').filter(l => l.trim()).forEach(l => console.log(`[${slug}:${stepLabel}:err] ${l}`));
          });
          const postCode = await new Promise((resolve) => postProc.on('close', resolve));
          console.log(`[AgentRunner] ${slug}: ${stepLabel} completado (code: ${postCode})`);
          // If a step fails, continue with next steps (non-critical)
          if (postCode !== 0) {
            console.log(`[AgentRunner] ${slug}: ${stepLabel} fallo (code: ${postCode}), continuando...`);
          }
        } catch (postErr) {
          console.log(`[AgentRunner] ${slug}: ${stepLabel} fallo (no critico): ${postErr.message}`);
        }
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const status = code === 0 ? 'completed' : 'failed';

    const errorMessages = [];
    if (code !== 0) errorMessages.push(`Codigo de salida: ${code}`);
    if (stderr.trim()) {
      // Last 500 chars of stderr
      errorMessages.push(stderr.trim().slice(-500));
    }

    const errors = errorMessages.length > 0 ? JSON.stringify(errorMessages) : null;

    lastOutput[slug] = {
      exitCode: code,
      stdout: stdout.slice(-2000),
      stderr: stderr.slice(-2000),
      duration,
      finishedAt: new Date().toISOString(),
    };

    try {
      await pool.query(
        `UPDATE executions SET status = ?, completed_at = NOW(), duration_seconds = ?, errors = ?
         WHERE id = ?`,
        [status, duration, errors, executionId]
      );
    } catch (err) {
      console.error('[AgentRunner] Error updating execution:', err);
    }

    delete runningProcesses[slug];
    console.log(`[AgentRunner] ${slug} termino con codigo ${code} en ${duration}s`);
    if (code !== 0 && stderr) {
      console.log(`[AgentRunner] Ultimos errores: ${stderr.slice(-300)}`);
    }
  });

  return {
    executionId,
    status: 'running',
    message: `Agente ${slug} iniciado`,
  };
}

function isRunning(slug) {
  return !!runningProcesses[slug];
}

function getRunningInfo(slug) {
  const info = runningProcesses[slug];
  if (!info) return null;
  return {
    executionId: info.executionId,
    elapsedSeconds: Math.round((Date.now() - info.startTime) / 1000),
    status: 'running',
  };
}

function getLastOutput(slug) {
  return lastOutput[slug] || null;
}

module.exports = { runAgent, isRunning, getRunningInfo, getLastOutput };
