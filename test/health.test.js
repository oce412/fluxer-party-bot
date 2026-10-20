import test from 'node:test';
import assert from 'node:assert/strict';
import { startHealthServer } from '../src/health.js';

test('health server exposes liveness and readiness separately', async () => {
  let ready = false;
  const health = await startHealthServer({ port: 0, host: '127.0.0.1', isReady: () => ready });
  try {
    assert.ok(health?.port > 0);
    const root = `http://127.0.0.1:${health.port}`;
    const liveness = await fetch(`${root}/healthz`);
    assert.equal(liveness.status, 200);
    assert.deepEqual(await liveness.json(), { status: 'ok', service: 'fluxer-party-events-bot' });
    const notReady = await fetch(`${root}/readyz`);
    assert.equal(notReady.status, 503);
    assert.deepEqual(await notReady.json(), { status: 'not_ready' });
    ready = true;
    const readiness = await fetch(`${root}/readyz`);
    assert.equal(readiness.status, 200);
    assert.deepEqual(await readiness.json(), { status: 'ready' });
    const missing = await fetch(`${root}/missing`);
    assert.equal(missing.status, 404);
  } finally {
    await health.close();
  }
});

test('health server can be disabled when no port is configured', async () => {
  assert.equal(await startHealthServer(), null);
  assert.equal(await startHealthServer({ port: null }), null);
});
