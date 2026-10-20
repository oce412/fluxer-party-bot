import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMigrations } from '../src/db-migrations.js';

function mockPool() {
  const applied = new Map();
  const sqlRuns = [];
  return {
    applied,
    sqlRuns,
    async query(sql) {
      if (String(sql).includes('CREATE TABLE IF NOT EXISTS party_schema_migrations')) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    },
    async connect() {
      return {
        async query(sql, params = []) {
          const source = String(sql);
          if (source === 'BEGIN' || source === 'COMMIT' || source === 'ROLLBACK') return { rowCount: 0, rows: [] };
          if (source.includes('pg_advisory_xact_lock')) return { rowCount: 1, rows: [] };
          if (source.includes('SELECT 1 FROM party_schema_migrations')) {
            const found = applied.has(params[0]);
            return { rowCount: found ? 1 : 0, rows: found ? [{ version: params[0] }] : [] };
          }
          if (source.includes('INSERT INTO party_schema_migrations')) {
            applied.set(params[0], params[1]);
            return { rowCount: 1, rows: [] };
          }
          sqlRuns.push(source);
          return { rowCount: 0, rows: [] };
        },
        release() {},
      };
    },
  };
}

test('migrations run in order once and are re-entrant', async () => {
  const pool = mockPool();
  const count = await applyMigrations(pool);
  assert.equal(count, 2);
  assert.deepEqual([...pool.applied.keys()], ['001', '002']);
  assert.equal(pool.sqlRuns.length, 2);
  await applyMigrations(pool);
  assert.equal(pool.sqlRuns.length, 2);
});
