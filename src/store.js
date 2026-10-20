import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';
import { applyMigrations } from './db-migrations.js';
import { log } from './logger.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const dataDirectory = path.resolve(projectRoot, process.env.DATA_DIR?.trim() || 'data');
const eventsFile = path.join(dataDirectory, 'events.json');
const settingsFile = path.join(dataDirectory, 'settings.json');

let events = [];
let guildSettings = {};
let userSettings = {};
let pool = null;
let backend = 'json';
let eventsWriteQueue = Promise.resolve();
let settingsWriteQueue = Promise.resolve();
let postgresEventsWriteQueue = Promise.resolve();

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function initStore() {
  await mkdir(dataDirectory, { recursive: true });
  const legacyEvents = await readJson(eventsFile, []);
  const legacySettings = await readJson(settingsFile, {});
  if (!Array.isArray(legacyEvents)) throw new Error('data/events.json must contain a JSON array.');
  if (!legacySettings || typeof legacySettings !== 'object' || Array.isArray(legacySettings)) {
    throw new Error('data/settings.json must contain a JSON object.');
  }

  if (String(process.env.DATABASE_URL ?? '').trim()) {
    try {
      await initPostgres(legacyEvents, legacySettings);
      backend = 'postgresql';
    } catch (error) {
      const failedPool = pool;
      pool = null;
      if (failedPool) await failedPool.end().catch(() => {});
      throw error;
    }
  } else {
    events = legacyEvents;
    guildSettings = legacySettings.guilds && typeof legacySettings.guilds === 'object' ? legacySettings.guilds : {};
    userSettings = legacySettings.users && typeof legacySettings.users === 'object' ? legacySettings.users : {};
    backend = 'json';
  }

  log.info('Store ready', { backend, savedEventCount: events.length, configuredServerCount: Object.keys(guildSettings).length, dataDirectory: backend === 'json' ? dataDirectory : undefined });
}

async function initPostgres(legacyEvents, legacySettings) {
  const sslEnabled = ['1', 'true', 'yes'].includes(String(process.env.DATABASE_SSL ?? '').toLowerCase());
  const max = Math.max(1, Math.min(20, Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10) || 5));
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: !['0', 'false', 'no'].includes(String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase()) } } : {}),
  });
  pool.on('error', (error) => log.error('PostgreSQL idle client error', { error }));

  await pool.query('SELECT 1');
  await applyMigrations(pool);

  // When a DATABASE_URL is first configured, import the existing JSON data only
  // into empty tables. This lets a developer move from local testing to SQL without
  // accidentally overwriting a database that already contains data.
  const eventCount = Number((await pool.query('SELECT COUNT(*)::int AS count FROM party_events')).rows[0].count);
  if (eventCount === 0 && legacyEvents.length) {
    await persistEvents(legacyEvents);
    log.info('Imported local events into PostgreSQL', { importedEventCount: legacyEvents.length });
  }

  const guildCount = Number((await pool.query('SELECT COUNT(*)::int AS count FROM party_guild_settings')).rows[0].count);
  const legacyGuilds = legacySettings.guilds && typeof legacySettings.guilds === 'object' ? legacySettings.guilds : {};
  if (guildCount === 0) {
    for (const [guildId, settings] of Object.entries(legacyGuilds)) {
      await pool.query(
        `INSERT INTO party_guild_settings (guild_id, settings) VALUES ($1, $2::jsonb)
         ON CONFLICT (guild_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`,
        [guildId, JSON.stringify(settings)],
      );
    }
  }

  const userCount = Number((await pool.query('SELECT COUNT(*)::int AS count FROM party_user_settings')).rows[0].count);
  const legacyUsers = legacySettings.users && typeof legacySettings.users === 'object' ? legacySettings.users : {};
  if (userCount === 0) {
    for (const [compoundKey, settings] of Object.entries(legacyUsers)) {
      const separator = compoundKey.indexOf(':');
      if (separator < 1 || !settings?.timeZone) continue;
      await pool.query(
        `INSERT INTO party_user_settings (guild_id, user_id, time_zone) VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, user_id) DO UPDATE SET time_zone = EXCLUDED.time_zone, updated_at = NOW()`,
        [compoundKey.slice(0, separator), compoundKey.slice(separator + 1), settings.timeZone],
      );
    }
  }

  const eventRows = await pool.query('SELECT payload FROM party_events ORDER BY starts_at NULLS LAST, id');
  events = eventRows.rows.map((row) => row.payload).filter((item) => item && typeof item === 'object');

  guildSettings = {};
  const guildRows = await pool.query('SELECT guild_id, settings FROM party_guild_settings');
  for (const row of guildRows.rows) guildSettings[row.guild_id] = row.settings ?? {};

  userSettings = {};
  const userRows = await pool.query('SELECT guild_id, user_id, time_zone FROM party_user_settings WHERE time_zone IS NOT NULL');
  for (const row of userRows.rows) userSettings[`${row.guild_id}:${row.user_id}`] = { timeZone: row.time_zone };
}

export function storageBackend() {
  return backend;
}

export async function isStoreHealthy() {
  if (backend === 'postgresql') {
    if (!pool) return false;
    await pool.query('SELECT 1');
  }
  return true;
}

export function allEvents() {
  return events;
}

export async function addEvents(newEvents) {
  events.push(...newEvents);
  try {
    await saveEvents(newEvents);
  } catch (error) {
    const ids = new Set(newEvents.map((event) => event.id));
    events = events.filter((event) => !ids.has(event.id));
    throw error;
  }
}

/** Persist only the supplied, mutated events where possible. Omitting the argument
 * means persist the whole in-memory snapshot (used for JSON storage and migrations). */
export async function saveEvents(eventsToSave = null) {
  const targets = Array.isArray(eventsToSave) ? eventsToSave : events;
  if (backend === 'postgresql') {
    const operation = postgresEventsWriteQueue.then(() => persistEvents(targets));
    postgresEventsWriteQueue = operation.catch(() => {});
    return operation;
  }
  return queueAtomicWrite('events', eventsFile, JSON.stringify(events, null, 2));
}

async function persistEvents(eventsToSave) {
  if (!pool || eventsToSave.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const event of eventsToSave) {
      await client.query(
        `INSERT INTO party_events
          (id, guild_id, series_id, series_index, status, starts_at, channel_id, message_id, payload, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           guild_id = EXCLUDED.guild_id,
           series_id = EXCLUDED.series_id,
           series_index = EXCLUDED.series_index,
           status = EXCLUDED.status,
           starts_at = EXCLUDED.starts_at,
           channel_id = EXCLUDED.channel_id,
           message_id = EXCLUDED.message_id,
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [
          event.id,
          event.guildId,
          event.seriesId ?? null,
          event.seriesIndex ?? null,
          event.status ?? 'scheduled',
          event.startsAt ?? null,
          event.channelId ?? null,
          event.messageId ?? null,
          JSON.stringify(event),
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function getGuildSettings(guildId) {
  return { ...(guildSettings[guildId] ?? {}) };
}

export async function updateGuildSettings(guildId, patch) {
  const previous = guildSettings[guildId] ? { ...guildSettings[guildId] } : undefined;
  guildSettings[guildId] = { ...(guildSettings[guildId] ?? {}), ...patch };
  try {
    await saveSettings(guildId);
  } catch (error) {
    if (previous) guildSettings[guildId] = previous;
    else delete guildSettings[guildId];
    throw error;
  }
  return getGuildSettings(guildId);
}

export function getUserTimeZone(guildId, userId) {
  return userSettings[`${guildId}:${userId}`]?.timeZone ?? null;
}

export async function setUserTimeZone(guildId, userId, timeZone) {
  const key = `${guildId}:${userId}`;
  const previous = userSettings[key];
  if (!timeZone) delete userSettings[key];
  else userSettings[key] = { timeZone };
  try {
    if (backend === 'postgresql') {
      if (timeZone) {
        await pool.query(
          `INSERT INTO party_user_settings (guild_id, user_id, time_zone) VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, user_id) DO UPDATE SET time_zone = EXCLUDED.time_zone, updated_at = NOW()`,
          [guildId, userId, timeZone],
        );
      } else {
        await pool.query('DELETE FROM party_user_settings WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
      }
    } else {
      await saveSettings();
    }
  } catch (error) {
    if (previous) userSettings[key] = previous;
    else delete userSettings[key];
    throw error;
  }
}

async function saveSettings(guildId = null) {
  if (backend === 'postgresql') {
    if (guildId) {
      await pool.query(
        `INSERT INTO party_guild_settings (guild_id, settings) VALUES ($1, $2::jsonb)
         ON CONFLICT (guild_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`,
        [guildId, JSON.stringify(guildSettings[guildId] ?? {})],
      );
    }
    return;
  }
  const snapshot = JSON.stringify({ guilds: guildSettings, users: userSettings }, null, 2);
  return queueAtomicWrite('settings', settingsFile, snapshot);
}

export async function closeStore() {
  if (pool) {
    const current = pool;
    pool = null;
    await current.end();
  }
}

function queueAtomicWrite(kind, filePath, contents) {
  const tempPath = `${filePath}.tmp`;
  const previous = kind === 'events' ? eventsWriteQueue : settingsWriteQueue;
  const operation = previous.then(async () => {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(tempPath, contents, 'utf8');
    await rename(tempPath, filePath);
  });
  if (kind === 'events') eventsWriteQueue = operation.catch(() => {});
  else settingsWriteQueue = operation.catch(() => {});
  return operation;
}
