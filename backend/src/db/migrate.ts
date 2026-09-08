import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';

export const runMigrations = async () => {
  console.log('🔄 Running database migrations...');
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(sql);
    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  runMigrations().then(() => pool.end());
}
