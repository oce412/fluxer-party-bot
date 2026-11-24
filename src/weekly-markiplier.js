export const WEEKLY_MARKIPLIER_CLIP_CHANCE = 1 / 100;

/**
 * Parse a comma-, semicolon-, or newline-separated list of HTTPS clip URLs.
 * Invalid entries are ignored so a malformed optional value cannot stop startup.
 */
export function parseMarkiplierClipUrls(value) {
  const entries = String(value ?? '').split(/[,;\r\n]+/);
  const valid = [];
  const seen = new Set();

  for (const entry of entries) {
    const candidate = entry.trim();
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) continue;
      const normalized = url.toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        valid.push(normalized);
      }
    } catch {
      // Ignore malformed optional clip URLs.
    }
  }
  return valid;
}

/** Return one random clip after a successful weekly roll, otherwise null. */
export function rollWeeklyMarkiplierClip(clips, random = Math.random) {
  const options = Array.isArray(clips)
    ? clips.filter((clip) => typeof clip === 'string' && clip.trim())
    : [];
  if (options.length === 0) return null;

  const chanceRoll = random();
  if (!Number.isFinite(chanceRoll) || chanceRoll < 0 || chanceRoll >= 1) {
    throw new RangeError('Random source must return a number in the interval [0, 1).');
  }
  if (chanceRoll >= WEEKLY_MARKIPLIER_CLIP_CHANCE) return null;

  const selectionRoll = random();
  if (!Number.isFinite(selectionRoll) || selectionRoll < 0 || selectionRoll >= 1) {
    throw new RangeError('Random source must return a number in the interval [0, 1).');
  }
  return options[Math.floor(selectionRoll * options.length)];
}
