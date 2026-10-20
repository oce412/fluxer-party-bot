/** Resolve an event ID only inside the caller's server boundary. */
export function findGuildScopedEvent(events, eventId, guildId) {
  const normalizedId = String(eventId ?? '').trim().replaceAll('`', '').toUpperCase();
  if (!normalizedId || !guildId) return null;
  return events.find((event) => String(event.id).toUpperCase() === normalizedId
    && String(event.guildId) === String(guildId)) ?? null;
}

/**
 * DM access is always host-only. In a server channel, the event must belong to
 * that exact server and the requester must be the host or a server admin.
 */
export function canManageEvent(event, { userId, guildId = null, isAdmin = false } = {}) {
  if (!event || !userId) return false;
  if (!guildId) return String(event.creatorId) === String(userId);
  if (String(event.guildId) !== String(guildId)) return false;
  return String(event.creatorId) === String(userId) || isAdmin === true;
}
