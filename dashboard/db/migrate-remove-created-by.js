/**
 * Migration: Remove created_by column from users table
 * Run: node db/migrate-remove-created-by.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../server/config/db');

async function migrate() {
  try {
    // Check if column exists
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'created_by'`
    );

    if (cols.length > 0) {
      // Drop FK first (name may vary), then column
      const [fks] = await pool.query(
        `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'created_by' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      for (const fk of fks) {
        console.log(`Dropping FK: ${fk.CONSTRAINT_NAME}`);
        await pool.query(`ALTER TABLE users DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
      }
      await pool.query('ALTER TABLE users DROP COLUMN created_by');
      console.log('[Migration] Removed created_by column from users table');
    } else {
      console.log('[Migration] created_by column does not exist, skipping');
    }

    process.exit(0);
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    process.exit(1);
  }
}

migrate();
