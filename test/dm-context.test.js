import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGuildSelection } from '../src/dm-context.js';

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
