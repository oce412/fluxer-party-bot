import test from 'node:test';
import assert from 'node:assert/strict';
import { canContinueEventManagementSession, canManageEvent, findGuildScopedEvent, findUniqueEventById } from '../src/authz.js';

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


test('management sessions require the actor to remain a community member', () => {
  assert.equal(canContinueEventManagementSession(events[0], {
    userId: 'host-a',
    isMember: true,
    authorizationMode: 'host',
  }), true);
  assert.equal(canContinueEventManagementSession(events[0], {
    userId: 'host-a',
    isMember: false,
    authorizationMode: 'host',
  }), false);
});

test('host sessions remain host-only even when an actor has admin permissions', () => {
  assert.equal(canContinueEventManagementSession(events[0], {
    userId: 'intruder',
    isMember: true,
    authorizationMode: 'host',
    isAdmin: true,
  }), false);
});

test('server-admin sessions re-check administrator permission on every reply', () => {
  assert.equal(canContinueEventManagementSession(events[0], {
    userId: 'admin-a',
    isMember: true,
    authorizationMode: 'server-admin',
    isAdmin: true,
  }), true);
  assert.equal(canContinueEventManagementSession(events[0], {
    userId: 'admin-a',
    isMember: true,
    authorizationMode: 'server-admin',
    isAdmin: false,
  }), false);
  assert.equal(canContinueEventManagementSession(events[0], {
    userId: 'admin-a',
    isMember: false,
    authorizationMode: 'server-admin',
    isAdmin: true,
  }), false);
});

test('unknown management-session authorization modes fail closed', () => {
  assert.equal(canContinueEventManagementSession(events[0], {
    userId: 'host-a',
    isMember: true,
    authorizationMode: 'unknown',
  }), false);
});

test('DM event lookup resolves a unique ID without requiring a community selection', () => {
  const distinct = [
    { id: 'ABC12345', guildId: 'server-a', creatorId: 'host-a' },
    { id: 'XYZ67890', guildId: 'server-b', creatorId: 'host-b' },
  ];
  assert.equal(findUniqueEventById(distinct, 'xyz67890'), distinct[1]);
  assert.equal(findUniqueEventById(distinct, 'missing'), null);
  assert.equal(findUniqueEventById(distinct, ''), null);
});

test('DM event lookup fails closed if corrupted legacy data has duplicate IDs', () => {
  assert.equal(findUniqueEventById(events, 'ABC12345'), null);
});
