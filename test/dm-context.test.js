import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDmGuildContext, DM_GUILD_CONTEXT_TTL_MS, getActiveDmGuildContext, peekDmGuildContext, resolveGuildSelection, setDmGuildContext } from '../src/dm-context.js';

const guilds = [
  { id: '100', name: 'Board Games' },
  { id: '200', name: 'Music Club' },
  { id: '300', name: 'Board Games' },
];

test('selects a community by one-based number', () => {
  assert.deepEqual(resolveGuildSelection('2', guilds), { ok: true, guild: guilds[1] });
});

test('selects a community by exact ID', () => {
  assert.deepEqual(resolveGuildSelection('300', guilds), { ok: true, guild: guilds[2] });
});

test('selects a unique community name case-insensitively', () => {
  assert.deepEqual(resolveGuildSelection('music club', guilds), { ok: true, guild: guilds[1] });
});

test('rejects ambiguous duplicate community names', () => {
  assert.deepEqual(resolveGuildSelection('Board Games', guilds), { ok: false, reason: 'ambiguous' });
});

test('rejects missing, partial and out-of-range selections', () => {
  assert.deepEqual(resolveGuildSelection('', guilds), { ok: false, reason: 'invalid' });
  assert.deepEqual(resolveGuildSelection('Board', guilds), { ok: false, reason: 'invalid' });
  assert.deepEqual(resolveGuildSelection('4', guilds), { ok: false, reason: 'invalid' });
  assert.deepEqual(resolveGuildSelection('1', []), { ok: false, reason: 'invalid' });
});


test('trims surrounding whitespace before resolving a community name or ID', () => {
  assert.deepEqual(resolveGuildSelection('  Music Club  ', guilds), { ok: true, guild: guilds[1] });
  assert.deepEqual(resolveGuildSelection('  100  ', guilds), { ok: true, guild: guilds[0] });
});


test('DM community context expires after ten minutes without follow-up commands', () => {
  const contexts = new Map();
  const now = 1_000_000;
  setDmGuildContext(contexts, 'user-1', '100', { now });
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now: now + DM_GUILD_CONTEXT_TTL_MS - 1 }), '100');
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now: now + DM_GUILD_CONTEXT_TTL_MS * 2 }), null);
  assert.equal(contexts.has('user-1'), false);
});

test('each follow-up command refreshes the idle expiry window', () => {
  const contexts = new Map();
  const now = 2_000_000;
  setDmGuildContext(contexts, 'user-1', '200', { now });
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now: now + 8 * 60 * 1000 }), '200');
  const refreshed = peekDmGuildContext(contexts, 'user-1', now + 8 * 60 * 1000);
  assert.equal(refreshed.expiresAt, now + 18 * 60 * 1000);
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now: now + 17 * 60 * 1000 }), '200');
});

test('wizard context remains pinned until explicitly cleared', () => {
  const contexts = new Map();
  const now = 3_000_000;
  setDmGuildContext(contexts, 'user-1', '300', { now, pinned: true });
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now: now + 24 * 60 * 60 * 1000 }), '300');
  assert.equal(clearDmGuildContext(contexts, 'user-1'), true);
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now: now + 24 * 60 * 60 * 1000 }), null);
});

test('DM community contexts are isolated per user', () => {
  const contexts = new Map();
  const now = 4_000_000;
  setDmGuildContext(contexts, 'user-1', '100', { now });
  setDmGuildContext(contexts, 'user-2', '200', { now });
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now }), '100');
  assert.equal(getActiveDmGuildContext(contexts, 'user-2', { now }), '200');
  clearDmGuildContext(contexts, 'user-1');
  assert.equal(getActiveDmGuildContext(contexts, 'user-1', { now }), null);
  assert.equal(getActiveDmGuildContext(contexts, 'user-2', { now }), '200');
});
