import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './logger.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const migrationsDirectory = path.join(projectRoot, 'migrations');
const MIGRATION_LOCK_ID = '716284031';

export async function applyMigrations(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS party_schema_migrations (
    version TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => /^\d{3}_[a-z0-9_-]+\.sql$/i.test(filename))
    .sort();

  for (const filename of filenames) {
    const version = filename.slice(0, 3);
    const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [MIGRATION_LOCK_ID]);
      const alreadyApplied = await client.query('SELECT 1 FROM party_schema_migrations WHERE version = $1', [version]);
      if (alreadyApplied.rowCount) {
        await client.query('COMMIT');
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO party_schema_migrations (version, filename) VALUES ($1, $2)',
        [version, filename],
      );
      await client.query('COMMIT');
      log.info('Database migration applied', { migration: version, filename });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      log.error('Database migration failed', { migration: version, filename, error });
      throw error;
    } finally {
      client.release();
    }
  }
  return filenames.length;
}
