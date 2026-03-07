const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

const SUPER_ADMIN_ID = 1;
const EMAIL_DOMAIN = '@megamayorista.org';

// All user routes require auth + only super admin (id=1)
router.use(auth);
router.use((req, res, next) => {
  if (req.user.id !== SUPER_ADMIN_ID) {
    return res.status(403).json({ error: 'Acceso restringido al administrador principal' });
  }
  next();
});

// GET /api/users — only id=1, returns all users
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, name, role, active, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[Users] Error list:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/users — create user
router.post('/', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (!['admin', 'seo', 'rrss'].includes(role)) {
      return res.status(400).json({ error: 'Rol invalido' });
    }

    // Name: 2-4 words
    const nameWords = name.trim().split(/\s+/).filter(Boolean);
    if (nameWords.length < 2 || nameWords.length > 4) {
      return res.status(400).json({ error: 'El nombre debe tener entre 2 y 4 palabras' });
    }

    // Email: must end with @megamayorista.org, max 50 chars
    if (email.length > 50) {
      return res.status(400).json({ error: 'El email no puede tener mas de 50 caracteres' });
    }
    if (!email.endsWith(EMAIL_DOMAIN)) {
      return res.status(400).json({ error: `El email debe terminar en ${EMAIL_DOMAIN}` });
    }

    // Password: max 15 characters
    if (password.length > 15) {
      return res.status(400).json({ error: 'La contrasena no puede tener mas de 15 caracteres' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, ?, TRUE)',
      [email, hash, name.trim(), role]
    );

    res.status(201).json({ id: result.insertId, email, name: name.trim(), role, active: 1 });
  } catch (err) {
    console.error('[Users] Error create:', err);
    res.status(500).json({ error: 'Error creando usuario' });
  }
});

// PUT /api/users/:id — edit user
router.put('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { name, email, password, role, active } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined && name.trim()) {
      const nameWords = name.trim().split(/\s+/).filter(Boolean);
      if (nameWords.length < 2 || nameWords.length > 4) {
        return res.status(400).json({ error: 'El nombre debe tener entre 2 y 4 palabras' });
      }
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (email !== undefined && email.trim()) {
      if (email.length > 50) {
        return res.status(400).json({ error: 'El email no puede tener mas de 50 caracteres' });
      }
      if (!email.endsWith(EMAIL_DOMAIN)) {
        return res.status(400).json({ error: `El email debe terminar en ${EMAIL_DOMAIN}` });
      }
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, targetId]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
      }
      updates.push('email = ?');
      values.push(email.trim());
    }
    if (password !== undefined && password.length > 0) {
      if (password.length > 15) {
        return res.status(400).json({ error: 'La contrasena no puede tener mas de 15 caracteres' });
      }
      updates.push('password_hash = ?');
      values.push(await bcrypt.hash(password, 10));
    }
    if (role !== undefined && ['admin', 'seo', 'rrss'].includes(role)) {
      updates.push('role = ?');
      values.push(role);
    }
    if (active !== undefined) {
      updates.push('active = ?');
      values.push(active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(targetId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query(
      'SELECT id, email, name, role, active, created_at FROM users WHERE id = ?', [targetId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Users] Error update:', err);
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
});

// DELETE /api/users/:id — never self or id=1
router.delete('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    if (targetId === SUPER_ADMIN_ID) {
      return res.status(400).json({ error: 'No se puede eliminar al administrador principal' });
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }

    const [check] = await pool.query('SELECT id FROM users WHERE id = ?', [targetId]);
    if (check.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Delete user_agent_settings first (FK), then user
    await pool.query('DELETE FROM user_agent_settings WHERE user_id = ?', [targetId]);
    await pool.query('DELETE FROM users WHERE id = ?', [targetId]);

    res.json({ success: true });
  } catch (err) {
    console.error('[Users] Error delete:', err);
    res.status(500).json({ error: 'Error eliminando usuario' });
  }
});

module.exports = router;
