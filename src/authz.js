/**
 * Resolve a globally unique event ID without requiring a DM community picker.
 * If legacy/corrupt data contains duplicates, fail closed rather than guess.
 */
export function findUniqueEventById(events, eventId) {
  const normalizedId = String(eventId ?? '').trim().replaceAll(String.fromCharCode(96), '').toUpperCase();
  if (!normalizedId || !Array.isArray(events)) return null;
  const matches = events.filter((event) => String(event?.id ?? '').toUpperCase() === normalizedId);
  return matches.length === 1 ? matches[0] : null;
}

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

/**
 * Re-authorize every reply in a DM host-management session.
 * Membership is mandatory; server-admin sessions additionally require the
 * administrator permission that originally allowed the non-host to open it.
 */
export function canContinueEventManagementSession(event, {
  userId,
  isMember = false,
  authorizationMode,
  isAdmin = false,
} = {}) {
  if (isMember !== true) return false;
  if (authorizationMode === 'host') {
    return canManageEvent(event, { userId });
  }
  if (authorizationMode === 'server-admin') {
    return canManageEvent(event, {
      userId,
      guildId: event?.guildId ?? null,
      isAdmin,
    });
  }
  return false;
}
