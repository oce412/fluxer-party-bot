/** Select valid, published future events for one community without trusting stored payload shapes. */
export function getUpcomingEvents(events, guildId, nowMillis = Date.now(), limit = 12) {
  if (!Array.isArray(events) || guildId === null || guildId === undefined) return [];
  const now = Number(nowMillis);
  const maxItems = Number.isInteger(limit) ? Math.max(0, limit) : 12;
  if (!Number.isFinite(now) || maxItems === 0) return [];

  return events
    .filter((event) => {
      if (!event || typeof event !== 'object') return false;
      if (String(event.guildId ?? event.guild_id ?? '') !== String(guildId)) return false;
      if (event.status !== 'scheduled' || !event.messageId) return false;
      const startsAt = typeof event.startsAt === 'string' ? Date.parse(event.startsAt) : NaN;
      return Number.isFinite(startsAt) && startsAt > now;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, maxItems);
}

/** Legacy or partially corrupted event payloads must not make list rendering throw. */
export function getEventAttendees(event) {
  if (!Array.isArray(event?.attendees)) return [];
  return event.attendees.filter((attendee) => attendee && typeof attendee === 'object' && !Array.isArray(attendee));
}
