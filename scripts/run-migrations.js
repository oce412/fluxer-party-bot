import { Pool } from 'pg';
import { applyMigrations } from '../src/db-migrations.js';
import { log } from '../src/logger.js';

if (!String(process.env.DATABASE_URL ?? '').trim()) {
  log.error('DATABASE_URL is required to run database migrations');
  process.exit(1);
}
const sslEnabled = ['1', 'true', 'yes'].includes(String(process.env.DATABASE_SSL ?? '').toLowerCase());
const rejectUnauthorized = !['0', 'false', 'no'].includes(String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase());
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
  ...(sslEnabled ? { ssl: { rejectUnauthorized } } : {}),
});
try {
  await applyMigrations(pool);
  log.info('Database migrations are up to date');
} catch (error) {
  log.error('Database migration command failed', { error });
  process.exitCode = 1;
} finally {
  await pool.end();
}
