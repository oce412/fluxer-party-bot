import test from 'node:test';
import assert from 'node:assert/strict';
import { compactNoticeOutbox, completeNoticeIfDelivered, createNoticeJob, markNoticeDelivered } from '../src/notices.js';

test('notice jobs deduplicate recipients and persist delivery progress', () => {
  const notice = createNoticeJob('Event changed', ['u1', 'u1', 'u2'], '2026-10-19T00:00:00.000Z');
  assert.deepEqual(notice.recipientIds, ['u1', 'u2']);
  markNoticeDelivered(notice, ['u1']);
  assert.equal(completeNoticeIfDelivered(notice, '2026-10-19T00:01:00.000Z'), false);
  markNoticeDelivered(notice, ['u2']);
  assert.equal(completeNoticeIfDelivered(notice, '2026-10-19T00:02:00.000Z'), true);
  assert.equal(notice.status, 'completed');
});

test('outbox compaction keeps all pending jobs but limits completed history', () => {
  const notices = [
    ...Array.from({ length: 12 }, (_, index) => ({ id: `done-${index}`, status: 'completed' })),
    { id: 'pending-a', status: 'pending' },
    { id: 'pending-b', status: 'pending' },
  ];
  const compacted = compactNoticeOutbox(notices, 5);
  assert.equal(compacted.filter((notice) => notice.status === 'completed').length, 5);
  assert.deepEqual(compacted.filter((notice) => notice.status === 'pending').map((notice) => notice.id), ['pending-a', 'pending-b']);
});
