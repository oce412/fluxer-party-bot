import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventAttendees, getUpcomingEvents } from '../src/event-list.js';

const now = Date.parse('2026-11-24T00:00:00.000Z');
const events = [
  { id: 'later', guildId: '100', status: 'scheduled', messageId: 'm3', startsAt: '2026-11-28T12:00:00.000Z' },
  { id: 'other-server', guildId: '200', status: 'scheduled', messageId: 'm4', startsAt: '2026-11-25T12:00:00.000Z' },
  { id: 'earlier', guildId: '100', status: 'scheduled', messageId: 'm2', startsAt: '2026-11-25T12:00:00.000Z' },
  { id: 'not-published', guildId: '100', status: 'scheduled', messageId: null, startsAt: '2026-11-25T13:00:00.000Z' },
  { id: 'past', guildId: '100', status: 'scheduled', messageId: 'm5', startsAt: '2026-11-23T12:00:00.000Z' },
  { id: 'completed', guildId: '100', status: 'completed', messageId: 'm6', startsAt: '2026-11-26T12:00:00.000Z' },
  { id: 'bad-date', guildId: '100', status: 'scheduled', messageId: 'm7', startsAt: 'not-a-date' },
  null,
];

test('selects only published future events for the requested community, in start-time order', () => {
  assert.deepEqual(getUpcomingEvents(events, '100', now).map((event) => event.id), ['earlier', 'later']);
});

test('returns an empty list for missing or invalid source data', () => {
  assert.deepEqual(getUpcomingEvents(null, '100', now), []);
  assert.deepEqual(getUpcomingEvents(events, null, now), []);
  assert.deepEqual(getUpcomingEvents(events, '100', Number.NaN), []);
});

test('respects a non-negative result limit', () => {
  assert.deepEqual(getUpcomingEvents(events, '100', now, 1).map((event) => event.id), ['earlier']);
  assert.deepEqual(getUpcomingEvents(events, '100', now, 0), []);
});

test('missing, null or malformed attendee lists safely become empty arrays', () => {
  assert.deepEqual(getEventAttendees(null), []);
  assert.deepEqual(getEventAttendees({}), []);
  assert.deepEqual(getEventAttendees({ attendees: null }), []);
  assert.deepEqual(getEventAttendees({ attendees: 'not-an-array' }), []);
  assert.deepEqual(getEventAttendees({ attendees: [null, 'bad', [], { userId: 'u1', status: 'yes' }] }), [
    { userId: 'u1', status: 'yes' },
  ]);
});
