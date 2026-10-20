import test from 'node:test';
import assert from 'node:assert/strict';
import { isGatewayConnectionHealthy } from '../src/gateway-health.js';

function mockClient({ ready = true, statuses = new Map([[0, 'open']]), error = null } = {}) {
  return {
    isReady: () => ready,
    ws: {
      fetchStatus: async () => {
        if (error) throw error;
        return statuses;
      },
    },
  };
}

test('gateway is healthy when SDK is ready and every shard is open', async () => {
  assert.equal(await isGatewayConnectionHealthy(mockClient(), true), true);
});

test('gateway is not healthy before a Ready or Resumed event', async () => {
  assert.equal(await isGatewayConnectionHealthy(mockClient(), false), false);
});

test('gateway is not healthy when the SDK reports not ready', async () => {
  assert.equal(await isGatewayConnectionHealthy(mockClient({ ready: false }), true), false);
});

test('gateway is not healthy while any shard is reconnecting', async () => {
  const statuses = new Map([[0, 'open'], [1, 'connecting']]);
  assert.equal(await isGatewayConnectionHealthy(mockClient({ statuses }), true), false);
});

test('gateway is not healthy when shard state is absent', async () => {
  assert.equal(await isGatewayConnectionHealthy(mockClient({ statuses: new Map() }), true), false);
});

test('gateway status errors return false instead of failing health checks', async () => {
  assert.equal(await isGatewayConnectionHealthy(mockClient({ error: new Error('temporary') }), true), false);
});
