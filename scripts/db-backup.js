import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../src/logger.js';

const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
if (!databaseUrl) {
  log.error('DATABASE_URL is required to back up PostgreSQL');
  process.exit(1);
}
const parsed = new URL(databaseUrl);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const backupDirectory = path.join(projectRoot, 'backups');
await mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(backupDirectory, `party-bot-${timestamp}.dump`);
const childEnv = { ...process.env };
childEnv.PGHOST = parsed.hostname;
childEnv.PGPORT = parsed.port || '5432';
childEnv.PGDATABASE = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
if (parsed.username) childEnv.PGUSER = decodeURIComponent(parsed.username);
if (parsed.password) childEnv.PGPASSWORD = decodeURIComponent(parsed.password);
const querySsl = parsed.searchParams.get('sslmode');
if (querySsl) childEnv.PGSSLMODE = querySsl;
else if (['1', 'true', 'yes'].includes(String(process.env.DATABASE_SSL ?? '').toLowerCase())) childEnv.PGSSLMODE = 'require';
const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', output], {
  env: childEnv,
  stdio: 'inherit',
  shell: false,
});
const exitCode = await new Promise((resolve) => {
  child.once('error', (error) => {
    log.error('Could not start pg_dump. Install PostgreSQL client tools and ensure pg_dump is on PATH.', { error });
    resolve(1);
  });
  child.once('close', (code) => resolve(code ?? 1));
});
if (exitCode !== 0) {
  await rm(output, { force: true }).catch(() => {});
  log.error('PostgreSQL backup failed', { exitCode });
  process.exit(exitCode || 1);
}
log.info('PostgreSQL backup completed', { output });
