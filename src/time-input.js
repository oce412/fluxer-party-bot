import { FixedOffsetZone, IANAZone } from 'luxon';

/** Normalize YYYY-MM-DD H:mm or YYYY-MM-DD HH:mm to YYYY-MM-DD HH:mm. */
export function normalizeLocalDateTimeInput(value) {
  const match = String(value ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const hour = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return `${match[1]} ${String(hour).padStart(2, '0')}:${match[3]}`;
}

/** Convert UTC/GMT offset spellings to Luxon's canonical fixed-offset zone name. */
export function normalizeFixedOffsetTimeZone(value) {
  const input = String(value ?? '').trim();
  if (/^(?:UTC|GMT)$/i.test(input)) return 'UTC';

  const match = input.match(/^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;

  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  if (hours === 0 && minutes === 0) return 'UTC';

  const minutePart = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`;
  return `UTC${match[1]}${hours}${minutePart}`;
}

/** Accept full IANA zones and supported fixed UTC offsets. */
export function isSupportedTimeZone(value) {
  const zone = String(value ?? '').trim();
  if (!zone) return false;
  if (zone === 'UTC' || zone === 'Etc/UTC' || IANAZone.isValidZone(zone)) return true;
  return Boolean(FixedOffsetZone.parseSpecifier(zone)?.isValid);
}

/** Use the server's default duration when an optional supplied value is invalid. */
export function resolveDurationMinutes(value, defaultValue, minimum = 15, maximum = 1440) {
  if (value === undefined || String(value).trim() === '') {
    return { minutes: defaultValue, defaulted: false };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return { minutes: defaultValue, defaulted: true };
  }
  return { minutes: parsed, defaulted: false };
}
