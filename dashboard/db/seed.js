const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    multipleStatements: true,
  });

  try {
    // Run init.sql
    const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    await connection.query(initSQL);
    console.log('[DB] Tablas creadas correctamente');

    // Seed admin user
    const passwordHash = await bcrypt.hash('megaMayorist@1', 12);
    await connection.query(
      `INSERT INTO omnivident.users (email, password_hash, name, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['gerencia@megamayorista.org', passwordHash, 'Gerencia MegaMayorista', 'admin']
    );
    console.log('[DB] Usuario admin creado: gerencia@megamayorista.org');

    console.log('[DB] Seed completado exitosamente');
  } catch (err) {
    console.error('[DB] Error en seed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
