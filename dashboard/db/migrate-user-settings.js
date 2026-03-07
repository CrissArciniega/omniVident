require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'omnivident',
  });

  // Create user_agent_settings table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_agent_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      agent_slug VARCHAR(50) NOT NULL,
      custom_name VARCHAR(100) DEFAULT NULL,
      custom_description TEXT DEFAULT NULL,
      custom_icon VARCHAR(50) DEFAULT NULL,
      custom_image LONGTEXT DEFAULT NULL,
      schedule_cron VARCHAR(50) DEFAULT NULL,
      schedule_description VARCHAR(100) DEFAULT NULL,
      UNIQUE KEY uq_user_agent (user_id, agent_slug),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_slug) REFERENCES agents(slug) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
  console.log('[Migrate] user_agent_settings table created / already exists');

  // Add schedule columns if table already existed without them
  try {
    await conn.query("ALTER TABLE user_agent_settings ADD COLUMN schedule_cron VARCHAR(50) DEFAULT NULL AFTER custom_image");
    console.log('[Migrate] schedule_cron column added');
  } catch (e) { console.log('[Migrate] schedule_cron column already exists'); }
  try {
    await conn.query("ALTER TABLE user_agent_settings ADD COLUMN schedule_description VARCHAR(100) DEFAULT NULL AFTER schedule_cron");
    console.log('[Migrate] schedule_description column added');
  } catch (e) { console.log('[Migrate] schedule_description column already exists'); }

  await conn.end();
  console.log('[Migrate] Done!');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
