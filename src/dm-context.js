/** Resolve a 1-based option, exact guild ID, or exact case-insensitive guild name. */
export function resolveGuildSelection(input, guilds) {
  const value = String(input ?? '').trim();
  const options = Array.isArray(guilds) ? guilds : [];
  if (!value || !options.length) return { ok: false, reason: 'invalid' };

  // IDs are numeric too, so resolve an exact ID before interpreting a number as a menu position.
  const byId = options.find((guild) => String(guild.id) === value);
  if (byId) return { ok: true, guild: byId };

  if (/^\d+$/.test(value)) {
    const index = Number(value);
    const guild = Number.isSafeInteger(index) ? options[index - 1] : null;
    return guild ? { ok: true, guild } : { ok: false, reason: 'invalid' };
  }

  const matches = options.filter((guild) => String(guild.name ?? '').trim().toLocaleLowerCase() === value.toLocaleLowerCase());
  if (matches.length === 1) return { ok: true, guild: matches[0] };
  if (matches.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: false, reason: 'invalid' };
}

export const DM_GUILD_CONTEXT_TTL_MS = 10 * 60 * 1000;

/** Remove an expired ordinary command-window context; pinned wizard contexts stay active. */
export function peekDmGuildContext(contexts, userId, now = Date.now()) {
  const context = contexts.get(userId);
  if (!context) return null;
  if (!context.pinned && (!Number.isFinite(context.expiresAt) || context.expiresAt <= now)) {
    contexts.delete(userId);
    return null;
  }
  return context;
}

/** Read and refresh a context after each command in the same short DM command window. */
export function getActiveDmGuildContext(contexts, userId, {
  now = Date.now(),
  ttlMs = DM_GUILD_CONTEXT_TTL_MS,
} = {}) {
  const context = peekDmGuildContext(contexts, userId, now);
  if (!context) return null;
  if (!context.pinned) context.expiresAt = now + ttlMs;
  return context.guildId;
}

/** Set a short-lived context, or pin it while a guided event-creation wizard is active. */
export function setDmGuildContext(contexts, userId, guildId, {
  now = Date.now(),
  ttlMs = DM_GUILD_CONTEXT_TTL_MS,
  pinned = false,
} = {}) {
  const context = {
    guildId: String(guildId),
    pinned: Boolean(pinned),
    expiresAt: pinned ? null : now + ttlMs,
  };
  contexts.set(userId, context);
  return context;
}

/** Explicitly clear a user's DM context, e.g. when a wizard ends or membership is lost. */
export function clearDmGuildContext(contexts, userId) {
  return contexts.delete(userId);
}
