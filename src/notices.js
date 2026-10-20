import { randomUUID } from 'node:crypto';

/** Create a durable, at-least-once notification job with unique recipient IDs. */
export function createNoticeJob(content, recipientIds, createdAt = new Date().toISOString()) {
  return {
    id: randomUUID(),
    content: String(content ?? ''),
    recipientIds: [...new Set((recipientIds ?? []).filter(Boolean).map(String))],
    deliveredIds: [],
    status: 'pending',
    createdAt,
    attempts: 0,
  };
}

export function markNoticeDelivered(notice, recipientIds) {
  const delivered = new Set(notice.deliveredIds ?? []);
  for (const userId of recipientIds ?? []) {
    if (userId) delivered.add(String(userId));
  }
  notice.deliveredIds = [...delivered];
  return notice;
}

export function completeNoticeIfDelivered(notice, completedAt = new Date().toISOString()) {
  const delivered = new Set(notice.deliveredIds ?? []);
  const recipientIds = notice.recipientIds ?? [];
  if (!recipientIds.every((userId) => delivered.has(userId))) return false;
  notice.status = 'completed';
  notice.completedAt = completedAt;
  delete notice.lastError;
  return true;
}

/** Keep all undelivered jobs plus only the newest small diagnostic history. */
export function compactNoticeOutbox(notices, completedHistoryLimit = 10) {
  const pending = (notices ?? []).filter((notice) => notice.status !== 'completed');
  const completed = (notices ?? []).filter((notice) => notice.status === 'completed').slice(-completedHistoryLimit);
  return [...completed, ...pending];
}
