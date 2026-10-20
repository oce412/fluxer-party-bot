import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageEvent, findGuildScopedEvent } from '../src/authz.js';

const events = [
  { id: 'ABC12345', guildId: 'server-a', creatorId: 'host-a' },
  { id: 'ABC12345', guildId: 'server-b', creatorId: 'host-b' },
];

test('event IDs resolve only inside the provided server', () => {
  assert.equal(findGuildScopedEvent(events, 'abc12345', 'server-a'), events[0]);
  assert.equal(findGuildScopedEvent(events, 'ABC12345', 'server-b'), events[1]);
  assert.equal(findGuildScopedEvent(events, 'ABC12345', 'server-c'), null);
  assert.equal(findGuildScopedEvent(events, 'ABC12345', null), null);
});

test('DM event management is host-only', () => {
  assert.equal(canManageEvent(events[0], { userId: 'host-a', guildId: null }), true);
  assert.equal(canManageEvent(events[0], { userId: 'intruder', guildId: null, isAdmin: true }), false);
});

test('server admins can manage events only within their own server', () => {
  assert.equal(canManageEvent(events[0], { userId: 'admin-a', guildId: 'server-a', isAdmin: true }), true);
  assert.equal(canManageEvent(events[0], { userId: 'admin-b', guildId: 'server-b', isAdmin: true }), false);
  assert.equal(canManageEvent(events[0], { userId: 'other', guildId: 'server-a', isAdmin: false }), false);
});
