/** Resolve a 1-based option, exact guild ID, or exact case-insensitive guild name. */
export function resolveGuildSelection(input, guilds) {
  const value = String(input ?? '').trim();
  const options = Array.isArray(guilds) ? guilds : [];
  if (!value || !options.length) return { ok: false, reason: 'invalid' };

  if (/^\d+$/.test(value)) {
    const index = Number(value);
    const guild = Number.isSafeInteger(index) ? options[index - 1] : null;
    return guild ? { ok: true, guild } : { ok: false, reason: 'invalid' };
  }

  const byId = options.find((guild) => String(guild.id) === value);
  if (byId) return { ok: true, guild: byId };

  const matches = options.filter((guild) => String(guild.name ?? '').trim().toLocaleLowerCase() === value.toLocaleLowerCase());
  if (matches.length === 1) return { ok: true, guild: matches[0] };
  if (matches.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: false, reason: 'invalid' };
}
