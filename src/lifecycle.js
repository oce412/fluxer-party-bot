/** Returns true while a published occurrence still owns its series' active slot. */
export function hasActivePublishedOccurrence(events) {
  return events.some((event) => Boolean(event.messageId)
    && ['scheduled', 'in_progress'].includes(event.status));
}

/** Classifies a reminder relative to its due time and grace window. */
export function getReminderWindow(nowMs, startsAtMs, offsetMinutes, graceMinutes) {
  const dueAtMs = startsAtMs - offsetMinutes * 60_000;
  const minutesLate = (nowMs - dueAtMs) / 60_000;
  if (minutesLate < 0) return 'not-due';
  if (minutesLate > graceMinutes) return 'expired';
  return 'due';
}
