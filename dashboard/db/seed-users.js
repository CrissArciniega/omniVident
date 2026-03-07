require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'omnivident',
  });

  // Migrate role enum and add active column
  try {
    await conn.query("UPDATE users SET role='admin' WHERE role='viewer'");
  } catch (e) { /* viewer might not exist */ }
  try {
    await conn.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','seo','rrss') DEFAULT 'seo'");
    console.log('[Seed] Role ENUM migrated');
  } catch (e) { console.log('[Seed] Role ENUM already OK'); }
  try {
    await conn.query("ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT TRUE AFTER role");
    console.log('[Seed] Active column added');
  } catch (e) { console.log('[Seed] Active column already exists'); }

  // Seed users
  const users = [
    { email: 'admin@omnivident.com', password: 'admin123', name: 'Admin', role: 'admin' },
    { email: 'seo@omnivident.com', password: 'seo123', name: 'SEO User', role: 'seo' },
    { email: 'rrss@omnivident.com', password: 'rrss123', name: 'RRSS User', role: 'rrss' },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await conn.query(
      `INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE role = VALUES(role), active = TRUE`,
      [u.email, hash, u.name, u.role]
    );
    console.log(`[Seed] ${u.email} (${u.role})`);
  }

  console.log('[Seed] Done!');
  await conn.end();
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
