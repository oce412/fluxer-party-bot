import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBotInviteUrl,
  FLUXER_INVITE_PERMISSIONS,
  getInvitePermissionBits,
} from '../src/invite-permissions.js';

test('minimum invite grants only the permissions needed for event posts and RSVP reactions', () => {
  const bits = getInvitePermissionBits();
  assert.equal(bits, 85_056n);
  assert.ok((bits & FLUXER_INVITE_PERMISSIONS.EMBED_LINKS) !== 0n);
  assert.ok((bits & FLUXER_INVITE_PERMISSIONS.VIEW_CHANNEL) !== 0n);
  assert.ok((bits & FLUXER_INVITE_PERMISSIONS.SEND_MESSAGES) !== 0n);
  assert.ok((bits & FLUXER_INVITE_PERMISSIONS.ADD_REACTIONS) !== 0n);
  assert.ok((bits & FLUXER_INVITE_PERMISSIONS.READ_MESSAGE_HISTORY) !== 0n);
  assert.equal((bits & FLUXER_INVITE_PERMISSIONS.MANAGE_MESSAGES) !== 0n, false);
  assert.equal((bits & 8n) !== 0n, false);
});

test('recommended invite adds only optional Manage Messages to the minimum set', () => {
  const minimum = getInvitePermissionBits();
  const recommended = getInvitePermissionBits({ manageMessages: true });
  assert.equal(recommended, 93_248n);
  assert.equal(recommended ^ minimum, FLUXER_INVITE_PERMISSIONS.MANAGE_MESSAGES);
});

test('builds a Fluxer OAuth2 bot invite with an exact permission bitfield', () => {
  const url = new URL(buildBotInviteUrl('1561731707562885120', getInvitePermissionBits()));
  assert.equal(url.origin, 'https://fluxer.app');
  assert.equal(url.pathname, '/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), '1561731707562885120');
  assert.equal(url.searchParams.get('scope'), 'bot');
  assert.equal(url.searchParams.get('permissions'), '85056');
});

test('rejects malformed application IDs and negative permissions', () => {
  assert.throws(() => buildBotInviteUrl('not-an-id', 1n), /Application ID/);
  assert.throws(() => buildBotInviteUrl('123456789012345', -1n), /negative/);
});
