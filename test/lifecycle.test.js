import test from 'node:test';
import assert from 'node:assert/strict';
import { getReminderWindow, hasActivePublishedOccurrence } from '../src/lifecycle.js';

test('an in-progress published event blocks the next occurrence in its series', () => {
  assert.equal(hasActivePublishedOccurrence([
    { messageId: 'first-post', status: 'in_progress' },
    { messageId: null, status: 'scheduled' },
  ]), true);
});

test('a completed occurrence no longer blocks the next occurrence', () => {
  assert.equal(hasActivePublishedOccurrence([
    { messageId: 'first-post', status: 'completed' },
    { messageId: null, status: 'scheduled' },
  ]), false);
});


test('a different series can publish while another series is in progress', () => {
  const inProgressSeries = [{ messageId: 'post-a', status: 'in_progress' }];
  const independentSeries = [{ messageId: null, status: 'scheduled' }];
  assert.equal(hasActivePublishedOccurrence(inProgressSeries), true);
  assert.equal(hasActivePublishedOccurrence(independentSeries), false);
});

test('a five-minute reminder is due for an event four minutes in the future', () => {
  const now = 10_000_000;
  const startsAt = now + 4 * 60_000;
  assert.equal(getReminderWindow(now, startsAt, 5, 15), 'due');
});

test('reminders outside their grace window are expired, not sent late', () => {
  const now = 10_000_000;
  const startsAt = now + 4 * 60_000;
  assert.equal(getReminderWindow(now, startsAt, 60, 15), 'expired');
});

test('reminders are not sent before their due time', () => {
  const now = 10_000_000;
  const startsAt = now + 10 * 60_000;
  assert.equal(getReminderWindow(now, startsAt, 5, 15), 'not-due');
});
