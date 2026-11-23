/** Returns true while a published occurrence still owns its series' active slot. */
export function hasActivePublishedOccurrence(events) {
  return events.some((event) => Boolean(event.messageId)
    && ['scheduled', 'in_progress'].includes(event.status));
}

/** Whether an opted-in event needs its one-time start notice queued. */
export function shouldQueueEventStartNotice(event) {
  return event?.notifyOnStart === true
    && event.status === 'in_progress'
    && !event.startNoticeQueuedAt;
}

/** Unique host + yes/maybe RSVP recipients for an event-start notice. */
export function getEventStartNoticeRecipients(event) {
  const recipients = new Set();
  if (event?.creatorId) recipients.add(String(event.creatorId));
  for (const attendee of event?.attendees ?? []) {
    if (['yes', 'maybe'].includes(attendee.status) && attendee.userId) {
      recipients.add(String(attendee.userId));
    }
  }
  return [...recipients];
}

/** Classifies a reminder relative to its due time and grace window. */
export function getReminderWindow(nowMs, startsAtMs, offsetMinutes, graceMinutes) {
  const dueAtMs = startsAtMs - offsetMinutes * 60_000;
  const minutesLate = (nowMs - dueAtMs) / 60_000;
  if (minutesLate < 0) return 'not-due';
  if (minutesLate > graceMinutes) return 'expired';
  return 'due';
}
