import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDmGuildContext, DM_GUILD_CONTEXT_TTL_MS, fetchGuildMemberSafely, getActiveDmGuildContext, isGuildMemberNotFound, peekDmGuildContext, resolveGuildSelection, setDmGuildContext } from '../src/dm-context.js';

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


test('awaits Fluxer member manager resolve and returns the fetched member', async () => {
  const expected = { id: 'user-1' };
  let resolveCalls = 0;
  const guild = {
    members: {
      get: () => null,
      resolve: async (userId) => {
        resolveCalls += 1;
        assert.equal(userId, 'user-1');
        return expected;
      },
    },
  };
  assert.equal(await fetchGuildMemberSafely(guild, 'user-1'), expected);
  assert.equal(resolveCalls, 1);
});

test('treats a Fluxer MEMBER_NOT_FOUND rejection as a normal non-membership result', async () => {
  const guild = {
    members: {
      get: () => null,
      resolve: async () => {
        throw Object.assign(new Error('Member not found in guild'), { code: 'MEMBER_NOT_FOUND' });
      },
      fetch: () => {
        throw new Error('fetch should not be called when resolve is available');
      },
    },
  };
  assert.equal(await fetchGuildMemberSafely(guild, 'user-not-in-this-guild'), null);
});

test('recognizes nested Fluxer UNKNOWN_MEMBER 404 errors', () => {
  const error = Object.assign(new Error('Fluxer API error'), {
    code: 'MEMBER_NOT_FOUND',
    cause: Object.assign(new Error("Member wasn't found in this community."), {
      code: 'UNKNOWN_MEMBER',
      statusCode: 404,
    }),
  });
  assert.equal(isGuildMemberNotFound(error), true);
});

test('does not hide unrelated member-fetch errors', async () => {
  const expected = Object.assign(new Error('Rate limited'), { code: 'RATE_LIMITED', statusCode: 429 });
  const guild = { members: { get: () => null, resolve: async () => { throw expected; } } };
  await assert.rejects(fetchGuildMemberSafely(guild, 'user-1'), (error) => error === expected);
});

test('uses an already cached member without making a REST request', async () => {
  const expected = { id: 'cached-user' };
  let resolveCalls = 0;
  const guild = {
    members: {
      get: (userId) => userId === 'cached-user' ? expected : null,
      resolve: async () => { resolveCalls += 1; throw new Error('should not fetch'); },
    },
  };
  assert.equal(await fetchGuildMemberSafely(guild, 'cached-user'), expected);
  assert.equal(resolveCalls, 0);
});
