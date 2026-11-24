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
    const livenessBody = await liveness.json();
    assert.equal(livenessBody.status, 'ok');
    assert.equal(livenessBody.service, 'fluxer-party-events-bot');
    assert.equal(typeof livenessBody.version, 'string');
    assert.equal(livenessBody.revision, 'unknown');
    const notReady = await fetch(`${root}/readyz`);
    assert.equal(notReady.status, 503);
    const notReadyBody = await notReady.json();
    assert.equal(notReadyBody.status, 'not_ready');
    assert.equal(notReadyBody.revision, 'unknown');
    ready = true;
    const readiness = await fetch(`${root}/readyz`);
    assert.equal(readiness.status, 200);
    const readinessBody = await readiness.json();
    assert.equal(readinessBody.status, 'ready');
    assert.equal(readinessBody.revision, 'unknown');
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


test('health endpoint reports the configured source revision for deployment checks', async () => {
  const previous = process.env.BUILD_REVISION;
  process.env.BUILD_REVISION = 'f0843eb7e5f2d96e2b1b0d80edf0448a14d18f62';
  const health = await startHealthServer({ port: 0, host: '127.0.0.1' });
  try {
    const response = await fetch(`http://127.0.0.1:${health.port}/healthz`);
    const body = await response.json();
    assert.equal(body.revision, 'f0843eb7e5f2d96e2b1b0d80edf0448a14d18f62');
  } finally {
    await health.close();
    if (previous === undefined) delete process.env.BUILD_REVISION;
    else process.env.BUILD_REVISION = previous;
  }
});
