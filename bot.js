import { Client, Events, PermissionFlags } from '@fluxerjs/core';
import { canManageEvent, findGuildScopedEvent } from './src/authz.js';
import { clearDmGuildContext, DM_GUILD_CONTEXT_TTL_MS, fetchGuildMemberSafely, getActiveDmGuildContext, peekDmGuildContext, resolveGuildSelection, setDmGuildContext } from './src/dm-context.js';
import { getEventAttendees, getUpcomingEvents } from './src/event-list.js';
import { buildEventAnnouncementEmbed, buildEventDetailsEmbed, buildUpcomingEventsEmbed } from './src/event-embeds.js';
import { startHealthServer } from './src/health.js';
import { isGatewayConnectionHealthy } from './src/gateway-health.js';
import { log, logConsoleStyle } from './src/logger.js';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { availableLocales, hasLocale, translate as translateText } from './src/i18n.js';
import { getEventStartNoticeRecipients, getReminderWindow, hasActivePublishedOccurrence, shouldQueueEventStartNotice } from './src/lifecycle.js';
import { isSupportedTimeZone, normalizeFixedOffsetTimeZone, normalizeLocalDateTimeInput, resolveDurationMinutes } from './src/time-input.js';
import { compactNoticeOutbox, completeNoticeIfDelivered, createNoticeJob, markNoticeDelivered } from './src/notices.js';
import {
  addEvents,
  allEvents,
  closeStore,
  getGuildSettings,
  getUserTimeZone,
  initStore,
  isStoreHealthy,
  saveEvents,
  setUserTimeZone,
  updateGuildSettings,
} from './src/store.js';

const token = process.env.FLUXER_BOT_TOKEN;
const APP_ENV = String(process.env.APP_ENV ?? 'development').trim().toLowerCase();
const EXPECTED_BOT_USER_ID = String(process.env.EXPECTED_BOT_USER_ID ?? '').trim();
const ENV_LANGUAGE_INPUT = String(process.env.BOT_LANGUAGE ?? 'en').trim().toLowerCase();
const ENV_LANGUAGE = hasLocale(ENV_LANGUAGE_INPUT) ? ENV_LANGUAGE_INPUT : 'en';
const ENV_DEFAULT_TIME_ZONE_INPUT = process.env.EVENT_DEFAULT_TIME_ZONE || 'Europe/Moscow';
const ENV_DEFAULT_TIME_ZONE = normalizeFixedOffsetTimeZone(ENV_DEFAULT_TIME_ZONE_INPUT) ?? ENV_DEFAULT_TIME_ZONE_INPUT;
const DEFAULT_EVENT_DURATION_MINUTES = 180;
const REMINDERS = [
  { minutes: 24 * 60, key: 'reminder24', id: '24h' },
  { minutes: 60, key: 'reminder1', id: '1h' },
  { minutes: 5, key: 'reminder5', id: '5m' },
];
const REMINDER_GRACE_MINUTES = 15;
const SCHEDULER_INTERVAL_MS = 30_000;
const MAX_SERIES_OCCURRENCES = 12;

const RSVP_EMOJI = new Map([
  ['✅', 'yes'],
  ['🤔', 'maybe'],
  ['❌', 'no'],
]);

const TZ_ALIASES = new Map([
  ['moscow', 'Europe/Moscow'], ['москва', 'Europe/Moscow'],
  ['kaliningrad', 'Europe/Kaliningrad'], ['калининград', 'Europe/Kaliningrad'],
  ['yekaterinburg', 'Asia/Yekaterinburg'], ['екатеринбург', 'Asia/Yekaterinburg'], ['екб', 'Asia/Yekaterinburg'],
  ['novosibirsk', 'Asia/Novosibirsk'], ['новосибирск', 'Asia/Novosibirsk'],
  ['vladivostok', 'Asia/Vladivostok'], ['владивосток', 'Asia/Vladivostok'],
  ['minsk', 'Europe/Minsk'], ['минск', 'Europe/Minsk'],
  ['kyiv', 'Europe/Kyiv'], ['киев', 'Europe/Kyiv'], ['київ', 'Europe/Kyiv'],
  ['amsterdam', 'Europe/Amsterdam'], ['амстердам', 'Europe/Amsterdam'],
  ['berlin', 'Europe/Berlin'], ['берлин', 'Europe/Berlin'],
  ['london', 'Europe/London'], ['лондон', 'Europe/London'],
  ['new york', 'America/New_York'], ['нью-йорк', 'America/New_York'],
  ['tokyo', 'Asia/Tokyo'], ['токио', 'Asia/Tokyo'],
  ['tbilisi', 'Asia/Tbilisi'], ['тбилиси', 'Asia/Tbilisi'],
  ['almaty', 'Asia/Almaty'], ['алматы', 'Asia/Almaty'],
  ['baku', 'Asia/Baku'], ['баку', 'Asia/Baku'],
  ['ankara', 'Europe/Istanbul'], ['istanbul', 'Europe/Istanbul'], ['стамбул', 'Europe/Istanbul'],
]);

function configForGuild(guildId) {
  const saved = guildId ? getGuildSettings(guildId) : {};
  const defaultZone = validTimeZone(ENV_DEFAULT_TIME_ZONE) ? ENV_DEFAULT_TIME_ZONE : 'Europe/Moscow';
  return {
    language: hasLocale(saved.language) ? saved.language : ENV_LANGUAGE,
    defaultTimeZone: saved.defaultTimeZone ?? defaultZone,
    announcementChannelId: saved.announcementChannelId ?? null,
    eventDurationMinutes: saved.eventDurationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES,
  };
}

function langForGuild(guildId) {
  const language = configForGuild(guildId).language;
  return hasLocale(language) ? language : ENV_LANGUAGE;
}

function t(key, values = {}, guildId = null) {
  return translateText(langForGuild(guildId), key, values);
}

function localeForGuild(guildId) {
  const language = langForGuild(guildId);
  return language === 'en' ? 'en-US' : language;
}

function languageOptionsText(guildId = null) {
  return availableLocales().map((language) => {
    const displayName = translateText(language, 'languageName');
    return `${language} (${displayName})`;
  }).join(', ');
}

function resolveTimeZone(raw, guildId) {
  const input = String(raw ?? '').trim();
  const lowered = input.toLowerCase();
  if (['default', 'по умолчанию', 'дефолт', 'server', 'сервер'].includes(lowered)) {
    return configForGuild(guildId).defaultTimeZone;
  }
  return normalizeFixedOffsetTimeZone(input) ?? TZ_ALIASES.get(lowered) ?? input;
}

function validTimeZone(zone) {
  return isSupportedTimeZone(zone);
}

function hasOffsetInTimeZone(zone, instant) {
  const offsetMinutes = instant.setZone(zone).offset;
  const sign = offsetMinutes >= 0 ? '+' : '−';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

function formatShortDateTime(instant, guildId) {
  const locale = localeForGuild(guildId);
  const language = langForGuild(guildId);
  return instant.setLocale(locale).toFormat(language === 'ru' ? 'd MMM yyyy, HH:mm' : 'MMM d, yyyy, HH:mm');
}

function timestampTag(event, style = 'F') {
  const startsAt = DateTime.fromISO(event.startsAt, { zone: 'utc' });
  if (!startsAt.isValid) return String(event.startsAt ?? '');
  return `<t:${Math.floor(startsAt.toMillis() / 1000)}:${style}>`;
}

function formatAnnouncementTime(event) {
  // Fluxer-compatible timestamp markup renders in the viewer's local time zone.
  return `📅 ${timestampTag(event, 'F')} · ${timestampTag(event, 'R')}`;
}

function formatDuration(minutes, guildId) {
  const value = Math.max(1, Number(minutes) || DEFAULT_EVENT_DURATION_MINUTES);
  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;
  if (langForGuild(guildId) === 'ru') {
    if (hours && remainingMinutes) return `${hours} ч ${remainingMinutes} мин`;
    if (hours) return `${hours} ч`;
    return `${remainingMinutes} мин`;
  }
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

function formatPersonalTime(event, userId) {
  const guildId = event.guildId;
  const preferredZone = userId ? getUserTimeZone(guildId, userId) : null;
  const zone = preferredZone ?? event.timeZone;
  const startUtc = DateTime.fromISO(event.startsAt, { zone: 'utc' });
  const local = startUtc.setZone(zone);
  const language = langForGuild(guildId);
  const primaryLabel = preferredZone
    ? `${t('personalTime', {}, guildId)}: ${formatShortDateTime(local, guildId)} · ${zone} (${hasOffsetInTimeZone(zone, startUtc)})`
    : `${t('eventTime', {}, guildId)}: ${formatShortDateTime(local, guildId)} · ${zone} (${hasOffsetInTimeZone(zone, startUtc)})`;
  const secondary = preferredZone && preferredZone !== event.timeZone
    ? `\n${t('eventTime', {}, guildId)}: ${formatShortDateTime(startUtc.setZone(event.timeZone), guildId)} · ${event.timeZone} (${hasOffsetInTimeZone(event.timeZone, startUtc)})`
    : '';
  const utc = `\n🌐 ${formatShortDateTime(startUtc, guildId)} UTC`;
  return `${primaryLabel}${secondary}${utc}`;
}

if (!['development', 'production'].includes(APP_ENV)) {
  log.error('APP_ENV must be either development or production', { appEnv: APP_ENV });
  process.exit(1);
}
if (APP_ENV === 'production' && !String(process.env.DATABASE_URL ?? '').trim()) {
  log.error('Production mode requires DATABASE_URL; JSON storage is not allowed for public production.');
  process.exit(1);
}
if (!token || token === 'replace_with_your_bot_token') {
  log.error('FLUXER_BOT_TOKEN is missing or still contains the example placeholder.');
  process.exit(1);
}

try {
  await initStore();
} catch (error) {
  log.error('Store initialization failed', { error, appEnv: APP_ENV });
  process.exit(1);
}

let gatewayReady = false;
const client = new Client();
const configuredHealthPort = String(process.env.HEALTH_PORT ?? '').trim();
const healthPortText = configuredHealthPort || String(process.env.PORT ?? '').trim();
const healthServer = await startHealthServer({
  port: healthPortText ? Number(healthPortText) : null,
  isReady: async () => gatewayReady
    && await isGatewayConnectionHealthy(client, gatewayReady)
    && await isStoreHealthy(),
});
if (healthServer) log.info('Health endpoints listening', { port: healthServer.port, paths: ['/healthz', '/readyz'] });

let schedulerTimer = null;
let schedulerBusy = false;
const publishingEventIds = new Set();
const setupSessions = new Map();
const hostManageSessions = new Map();
const eventCreateSessions = new Map();
const dmGuildContexts = new Map();
const dmGuildSelectionSessions = new Map();
const SETUP_SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_DM_GUILD_OPTIONS = 20;
const DM_GUILD_SELECTION_SESSION_TTL_MS = DM_GUILD_CONTEXT_TTL_MS;
const EVENT_CREATE_SESSION_TTL_MS = 30 * 60 * 1000;
const EVENT_CREATE_STEPS = ['dateTime', 'timeZone', 'limit', 'repeat', 'duration', 'notifyOnStart', 'title', 'description', 'confirm'];
const SETUP_FLOW_STEPS = ['channel', 'timezone', 'language', 'duration'];

client.on(Events.Error, (error) => {
  gatewayReady = false;
  log.error('Fluxer client error; gateway readiness cleared until Ready/Resumed', { error });
});

client.on(Events.Ready, () => {
  const currentBotId = String(client.user?.id ?? '');
  if (EXPECTED_BOT_USER_ID && currentBotId !== EXPECTED_BOT_USER_ID) {
    gatewayReady = false;
    log.error('Connected bot ID does not match EXPECTED_BOT_USER_ID; refusing to continue.', { expectedBotUserId: EXPECTED_BOT_USER_ID, actualBotUserId: currentBotId, appEnv: APP_ENV });
    void shutdown('BOT_ID_MISMATCH');
    return;
  }
  gatewayReady = true;
  log.info('Fluxer gateway ready', { username: client.user?.username ?? 'your bot', botUserId: currentBotId, appEnv: APP_ENV });
  if (schedulerTimer === null) {
    void runSchedulerSafely();
    schedulerTimer = setInterval(() => void runSchedulerSafely(), SCHEDULER_INTERVAL_MS);
  }
});

// Fluxer.js may resume an existing gateway session without emitting Ready again.
// Restore readiness here so a transient gateway error does not leave /readyz stuck.
client.on(Events.Resumed, () => {
  gatewayReady = true;
  log.info('Fluxer gateway session resumed', {
    botUserId: String(client.user?.id ?? ''),
    pingMs: client.ws?.ping ?? null,
    appEnv: APP_ENV,
  });
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author?.bot || !message.content) return;
    const text = message.content.trim();

    if (text.toLowerCase() === '!ping') {
      await safeReply(message, t('ping', {}, message.guildId));
      return;
    }

    const rootMatch = text.match(/^!(event|событие|ивент)(?:\s+([\s\S]*))?$/i);
    if (!message.guildId && !rootMatch) {
      if (eventCreateSessions.has(message.author.id)) {
        await handleEventCreateWizardAnswer(message, text);
        return;
      }
      if (hostManageSessions.has(message.author.id)) {
        await handleHostManageInput(message, text);
        return;
      }
      if (setupSessions.has(message.author.id)) {
        await handleSetupWizardAnswer(message, text);
        return;
      }
      if (dmGuildSelectionSessions.has(message.author.id)) {
        await handleDmGuildSelectionInput(message, text);
        return;
      }
    }
    if (!rootMatch) return;

    const remainder = (rootMatch[2] ?? '').trim();
    const commandMatch = remainder.match(/^(\S+)?(?:\s+([\s\S]*))?$/);
    const rawCommand = (commandMatch?.[1] ?? 'help').toLowerCase();
    const tail = (commandMatch?.[2] ?? '').trim();
    const aliases = new Map([
      ['помощь', 'help'], ['создать', 'create'], ['список', 'list'], ['инфо', 'info'], ['информация', 'info'],
      ['отменить', 'cancel'], ['зоны', 'zones'], ['настройка', 'setup'], ['настройки', 'setup'], ['конфиг', 'setup'],
      ['язык', 'language'], ['языки', 'language'], ['перевод', 'language'], ['переводы', 'language'], ['languages', 'language'], ['lang', 'language'], ['translate', 'language'],
      ['моязона', 'myzone'], ['мойпояс', 'myzone'], ['личныйпояс', 'myzone'], ['зона', 'myzone'],
      ['записаться', 'rsvp'], ['статус', 'rsvp'], ['управление', 'manage'], ['меню', 'manage'],
      ['server', 'server'], ['servers', 'server'], ['community', 'server'], ['communities', 'server'],
      ['сервер', 'server'], ['сообщество', 'server'], ['сообщества', 'server'],
    ]);
    const command = aliases.get(rawCommand) ?? rawCommand;

    if (!message.guildId) {
      // A new root command intentionally leaves the current creation conversation.
      // Plain-text replies continue to belong to the active wizard; explicit commands do not.
      const startsOrRestartsWizard = command === 'create'
        && (!tail || ['wizard', 'мастер', 'guided'].includes(tail.toLowerCase()));
      if (eventCreateSessions.has(message.author.id)
        && !startsOrRestartsWizard
        && !(command === 'cancel' && !tail)) {
        eventCreateSessions.delete(message.author.id);
        clearDmGuildContext(dmGuildContexts, message.author.id);
        await message.author.send(t('createWizardCancelled', {}, null));
      }
      if (command === 'language') {
        await languageSupportCommand(message, tail, null);
      } else if (command === 'setup') {
        await setupCommand(message, tail);
      } else if (command === 'server') {
        await selectDmGuild(message, null, null, tail);
      } else if (command === 'cancel' && !tail && eventCreateSessions.has(message.author.id)) {
        eventCreateSessions.delete(message.author.id);
        clearDmGuildContext(dmGuildContexts, message.author.id);
        await message.author.send(t('createWizardCancelled', {}, null));
      } else if (command === 'manage') {
        await selectDmGuild(message, command, tail);
      } else if (['cancel', 'отмена', 'стоп'].includes(command) && hostManageSessions.has(message.author.id)) {
        hostManageSessions.delete(message.author.id);
        await message.author.send(t('hostManageClosed', {}, null));
      } else if (['cancel', 'отмена', 'стоп'].includes(command) && setupSessions.has(message.author.id)) {
        setupSessions.delete(message.author.id);
        await message.author.send(t('setupWizardCancelled', {}, null));
      } else if (['create', 'list', 'info', 'rsvp', 'cancel', 'myzone'].includes(command)) {
        await selectDmGuild(message, command, tail);
      } else if (command === 'zones') {
        await privateResponse(message, t('zones', {}, null));
      } else if (command === 'help') {
        await privateResponse(message, t('dmHelp', {}, null));
      } else {
        await privateResponse(message, t('dmServerUsage', {}, null));
      }
      return;
    }

    switch (command) {
      case 'help':
        await privateResponse(message, t('help', {}, message.guildId));
        break;
      case 'create':
        if (!tail || ['wizard', 'мастер', 'guided'].includes(tail.toLowerCase())) {
          await startEventCreationWizard(message, message.guildId);
        } else if (tail.includes('|')) {
          await createEventSeries(message, tail, message.guildId);
        } else {
          await privateResponse(message, t('createUsage', {}, message.guildId));
        }
        break;
      case 'list':
        await listEvents(message, message.guildId);
        break;
      case 'info':
        await showEventInfo(message, tail, message.guildId);
        break;
      case 'rsvp':
        await commandRsvp(message, tail, message.guildId);
        break;
      case 'cancel':
        await cancelEvent(message, tail, message.guildId);
        break;
      case 'manage':
        await startEventManagement(message, tail);
        break;
      case 'zones':
        await privateResponse(message, t('zones', {}, message.guildId));
        break;
      case 'setup':
        await setupCommand(message, tail);
        break;
      case 'myzone':
        await myZoneCommand(message, tail);
        break;
      case 'language':
        await languageSupportCommand(message, tail, message.guildId);
        break;
      default:
        await privateResponse(message, t('unknownCommand', { command: rawCommand }, message.guildId));
    }
  } catch (error) {
    logConsoleStyle('error', '[Message handler]', error);
    try {
      await privateResponse(message, t('genericError', {}, message.guildId));
    } catch (replyError) {
      logConsoleStyle('error', '[Private error reply failed]', replyError);
    }
  }
});

client.on(Events.MessageReactionAdd, async ({ message, reaction, emoji, userId, user, messageId }) => {
  try {
    if (user?.bot || !userId || userId === client.user?.id) return;
    const status = RSVP_EMOJI.get(emoji?.name);
    if (!status) return;

    const event = allEvents().find((item) => item.messageId === messageId);
    const sourceGuildId = message?.guildId ?? message?.guild_id;
    if (!event || (sourceGuildId && String(sourceGuildId) !== String(event.guildId)) || event.status !== 'scheduled' || isEventStarted(event)) return;

    const result = changeRsvp(event, userId, user?.username ?? `User-${userId.slice(-4)}`, status);
    if (!result.ok) {
      const sentPrivately = user?.send ? await user.send(result.reason).then(() => true).catch(() => false) : false;
      if (!sentPrivately) {
        const eventMessage = message ?? (reaction ? await reaction.fetchMessage() : null);
        if (eventMessage) {
          await eventMessage.reply({ content: result.reason, allowedMentions: { parse: [], repliedUser: false } });
        }
      }
      return;
    }

    await saveEvents([event]);
    await refreshEventPost(event);
  } catch (error) {
    logConsoleStyle('error', '[RSVP reaction add]', error);
  }
});

client.on(Events.MessageReactionRemove, async ({ emoji, userId, messageId, message }) => {
  try {
    if (!userId || userId === client.user?.id) return;
    const status = RSVP_EMOJI.get(emoji?.name);
    if (status !== 'yes' && status !== 'maybe') return;
    const event = allEvents().find((item) => item.messageId === messageId);
    const sourceGuildId = message?.guildId ?? message?.guild_id;
    if (!event || (sourceGuildId && String(sourceGuildId) !== String(event.guildId)) || event.status !== 'scheduled' || isEventStarted(event)) return;

    const attendee = event.attendees.find((item) => item.userId === userId);
    if (!attendee || attendee.status !== status) return;
    event.attendees = event.attendees.filter((item) => item.userId !== userId);
    await saveEvents([event]);
    await refreshEventPost(event);
  } catch (error) {
    logConsoleStyle('error', '[RSVP reaction remove]', error);
  }
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  gatewayReady = false;
  if (schedulerTimer) clearInterval(schedulerTimer);
  log.info('Shutting down party bot', { signal, appEnv: APP_ENV });
  try { if (healthServer) await healthServer.close(); } catch (error) { logConsoleStyle('error', 'Health server shutdown failed', error); }
  try { await closeStore(); } catch (error) { logConsoleStyle('error', 'Store shutdown failed', error); }
  process.exit(signal === 'LOGIN_FAILURE' || signal === 'BOT_ID_MISMATCH' ? 1 : 0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await client.login(token);
} catch (error) {
  logConsoleStyle('error', 'Fluxer login failed', error);
  await shutdown('LOGIN_FAILURE');
}

async function safeReply(message, content) {
  await message.reply({ content, allowedMentions: { parse: [], repliedUser: false } });
}

async function privateResponse(message, content, { deleteCommand = true } = {}) {
  try {
    for (const chunk of splitPrivateMessageContent(content)) {
      await message.author.send(chunk);
    }
    if (deleteCommand && typeof message.delete === 'function') {
      try { await message.delete(); } catch { /* Manage Messages is optional. */ }
    }
    return true;
  } catch (error) {
    logConsoleStyle('warn', '[DM response unavailable]', error?.message ?? error);
    try {
      await safeReply(message, t('dmFailed', {}, message.guildId));
    } catch (replyError) {
      logConsoleStyle('error', '[DM fallback failed]', replyError?.message ?? replyError);
    }
    return false;
  }
}

async function privateEmbedResponse(message, embed, { deleteCommand = true } = {}) {
  try {
    await message.author.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
    if (deleteCommand && typeof message.delete === 'function') {
      try { await message.delete(); } catch { /* Manage Messages is optional. */ }
    }
    return true;
  } catch (error) {
    logConsoleStyle('warn', '[DM embed response unavailable]', error?.message ?? error);
    try {
      await safeReply(message, t('dmFailed', {}, message.guildId));
    } catch (replyError) {
      logConsoleStyle('error', '[DM embed fallback failed]', replyError?.message ?? replyError);
    }
    return false;
  }
}

function splitPrivateMessageContent(content, maxLength = 1800) {
  const text = String(content ?? '');
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let current = '';
  for (const sourceLine of text.split('\n')) {
    let line = sourceLine;
    while (line.length > maxLength) {
      if (current) { chunks.push(current); current = ''; }
      chunks.push(line.slice(0, maxLength));
      line = line.slice(maxLength);
    }
    const separatorLength = current ? 1 : 0;
    if (current.length + separatorLength + line.length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current || chunks.length === 0) chunks.push(current);
  return chunks;
}

function getCollectionItem(collection, id) {
  if (!collection) return null;
  if (typeof collection.get === 'function') {
    try { const value = collection.get(id); if (value) return value; } catch { /* Try other shapes. */ }
  }
  if (collection.cache && typeof collection.cache.get === 'function') {
    try { const value = collection.cache.get(id); if (value) return value; } catch { /* Try array/object lookup. */ }
  }
  if (Array.isArray(collection)) return collection.find((item) => String(item?.id) === String(id)) ?? null;
  if (typeof collection === 'object' && Object.prototype.hasOwnProperty.call(collection, id)) return collection[id] ?? null;
  return null;
}

async function fetchGuildMember(guild, userId) {
  try {
    return await fetchGuildMemberSafely(guild, userId);
  } catch (error) {
    logConsoleStyle('warn', '[Guild member lookup failed for ' + userId + ' in ' + guild?.id + ']', error?.message ?? error);
    return null;
  }
}
async function isUserMemberInGuild(guildId, userId) {
  let guild = getCollectionItem(client.guilds, guildId) ?? getCollectionItem(client.guilds?.cache, guildId);
  if (!guild && typeof client.guilds?.fetch === 'function') {
    guild = await client.guilds.fetch(guildId).catch(() => null);
  }
  if (!guild) return false;
  const ownerId = guild.ownerId ?? guild.owner_id;
  if (ownerId && String(ownerId) === String(userId)) return true;
  return Boolean(await fetchGuildMember(guild, userId));
}

async function findMemberGuilds(userId) {
  const candidatesById = new Map();
  for (const guild of collectionValues(client.guilds)) {
    if (guild?.id && guild.available !== false) candidatesById.set(String(guild.id), guild);
  }
  const accessible = [];
  for (const candidate of candidatesById.values()) {
    try {
      if (await isUserMemberInGuild(candidate.id, userId)) {
        accessible.push({ id: String(candidate.id), name: String(candidate.name ?? 'Unnamed server') });
      }
    } catch (error) {
      logConsoleStyle('warn', '[DM server membership check failed for ' + candidate.id + ']', error?.message ?? error);
    }
  }
  return accessible.sort((a, b) => a.name.localeCompare(b.name));
}

async function selectDmGuild(message, pendingCommand = null, pendingArguments = '', requestedInput = '') {
  const userId = message.author.id;
  const accessible = await findMemberGuilds(userId);
  if (!accessible.length) {
    dmGuildSelectionSessions.delete(userId);
    clearDmGuildContext(dmGuildContexts, userId);
    await message.author.send(t('dmNoServers', {}, null));
    return;
  }

  const input = String(requestedInput ?? '').trim();
  const activeGuildId = getActiveDmGuildContext(dmGuildContexts, userId);
  if (!input && pendingCommand && activeGuildId) {
    const current = accessible.find((guild) => guild.id === String(activeGuildId));
    if (current) {
      dmGuildSelectionSessions.delete(userId);
      await dispatchDmEventCommand(message, pendingCommand, pendingArguments, current.id);
      return;
    }
  }

  if (input) {
    const resolved = resolveGuildSelection(input, accessible);
    if (!resolved.ok) {
      await message.author.send(resolved.reason === 'ambiguous'
        ? t('dmServerAmbiguous', { options: formatDmGuildOptions(accessible) }, null)
        : t('dmServerSelectionInvalid', { options: formatDmGuildOptions(accessible) }, null));
      return;
    }
    setDmGuildContext(dmGuildContexts, userId, resolved.guild.id);
    dmGuildSelectionSessions.delete(userId);
    await message.author.send(t('dmServerSelected', { guild: resolved.guild.name }, resolved.guild.id));
    if (pendingCommand) await dispatchDmEventCommand(message, pendingCommand, pendingArguments, resolved.guild.id);
    return;
  }

  if (accessible.length === 1) {
    setDmGuildContext(dmGuildContexts, userId, accessible[0].id);
    dmGuildSelectionSessions.delete(userId);
    if (pendingCommand) await dispatchDmEventCommand(message, pendingCommand, pendingArguments, accessible[0].id);
    else await message.author.send(t('dmServerSelected', { guild: accessible[0].name }, accessible[0].id));
    return;
  }

  const currentContext = peekDmGuildContext(dmGuildContexts, userId);
  const currentGuild = currentContext
    ? accessible.find((guild) => guild.id === String(currentContext.guildId))
    : null;
  dmGuildSelectionSessions.set(userId, {
    guilds: accessible,
    pendingCommand,
    pendingArguments,
    expiresAt: Date.now() + DM_GUILD_SELECTION_SESSION_TTL_MS,
  });
  await message.author.send(t('dmServerPrompt', {
    options: formatDmGuildOptions(accessible),
    current: currentGuild?.name ?? t('dmNoCurrentServer', {}, null),
  }, null));
}

function formatDmGuildOptions(guilds) {
  const visible = guilds.slice(0, MAX_DM_GUILD_OPTIONS);
  const lines = visible.map((guild, index) => (index + 1) + '. **' + guild.name + '**').join('\n');
  const more = guilds.length > visible.length ? '\n' + t('dmServerPromptMore', { count: guilds.length }, null) : '';
  return lines + more;
}

async function handleDmGuildSelectionInput(message, rawInput) {
  const session = dmGuildSelectionSessions.get(message.author.id);
  if (!session) return;
  if (session.expiresAt <= Date.now()) {
    dmGuildSelectionSessions.delete(message.author.id);
    await message.author.send(t('dmServerSelectionExpired', {}, null));
    return;
  }
  const input = String(rawInput ?? '').trim();
  if (['cancel', 'отмена', 'стоп'].includes(input.toLowerCase())) {
    dmGuildSelectionSessions.delete(message.author.id);
    await message.author.send(t('dmServerSelectionCancelled', {}, null));
    return;
  }
  const resolved = resolveGuildSelection(input, session.guilds);
  if (!resolved.ok) {
    await message.author.send(resolved.reason === 'ambiguous'
      ? t('dmServerAmbiguous', { options: formatDmGuildOptions(session.guilds) }, null)
      : t('dmServerSelectionInvalid', { options: formatDmGuildOptions(session.guilds) }, null));
    return;
  }
  if (!(await isUserMemberInGuild(resolved.guild.id, message.author.id))) {
    dmGuildSelectionSessions.delete(message.author.id);
    clearDmGuildContext(dmGuildContexts, message.author.id);
    await message.author.send(t('dmServerNotMember', { guild: resolved.guild.name }, null));
    return;
  }

  setDmGuildContext(dmGuildContexts, message.author.id, resolved.guild.id);
  dmGuildSelectionSessions.delete(message.author.id);
  await message.author.send(t('dmServerSelected', { guild: resolved.guild.name }, resolved.guild.id));
  if (session.pendingCommand) {
    await dispatchDmEventCommand(message, session.pendingCommand, session.pendingArguments, resolved.guild.id);
  }
}

async function dispatchDmEventCommand(message, command, rawArguments, guildId) {
  if (!(await isUserMemberInGuild(guildId, message.author.id))) {
    clearDmGuildContext(dmGuildContexts, message.author.id);
    await message.author.send(t('dmServerNotMember', { guild: guildId }, null));
    return;
  }
  switch (command) {
    case 'create':
      if (!rawArguments.trim() || ['wizard', 'мастер', 'guided'].includes(rawArguments.trim().toLowerCase())) {
        await startEventCreationWizard(message, guildId);
      } else if (rawArguments.includes('|')) {
        await createEventSeries(message, rawArguments, guildId);
      } else {
        await message.author.send(t('createUsage', {}, guildId));
      }
      break;
    case 'list': await listEvents(message, guildId); break;
    case 'info': await showEventInfo(message, rawArguments, guildId); break;
    case 'rsvp': await commandRsvp(message, rawArguments, guildId); break;
    case 'cancel': await cancelEvent(message, rawArguments, guildId); break;
    case 'manage': await startEventManagement(message, rawArguments, guildId); break;
    case 'zones': await privateResponse(message, t('zones', {}, guildId)); break;
    case 'myzone': await myZoneCommand(message, rawArguments, guildId); break;
    default: await message.author.send(t('dmServerUsage', {}, guildId));
  }
}
async function setupCommand(message, rawArguments) {
  const input = String(rawArguments ?? '').trim();
  if (!message.guildId) {
    await startSetupFromDm(message, input);
    return;
  }

  if (!(await isServerAdmin(message))) {
    await privateResponse(message, t('adminOnly', {}, message.guildId));
    return;
  }

  // No arguments starts the guided wizard. A setting name starts a one-setting wizard
  // if no value was supplied; the legacy value form remains available for quick changes.
  const parts = input.split(/\s+/).filter(Boolean);
  const actionRaw = (parts.shift() ?? '').toLowerCase();
  const actionMap = new Map([
    ['канал', 'channel'], ['channel', 'channel'],
    ['зона', 'timezone'], ['часовойпояс', 'timezone'], ['timezone', 'timezone'], ['zone', 'timezone'],
    ['язык', 'language'], ['language', 'language'], ['lang', 'language'],
    ['длительность', 'duration'], ['duration', 'duration'],
  ]);
  const action = actionMap.get(actionRaw) ?? actionRaw;
  const guildId = message.guildId;

  if (!action) {
    await beginSetupWizard(message.author, guildId, SETUP_FLOW_STEPS, message);
    return;
  }

  if (action === 'channel' && parts.length === 0) {
    await beginSetupWizard(message.author, guildId, ['channel'], message);
    return;
  }
  if (action === 'timezone' && parts.length === 0) {
    await beginSetupWizard(message.author, guildId, ['timezone'], message);
    return;
  }
  if (action === 'language' && parts.length === 0) {
    await beginSetupWizard(message.author, guildId, ['language'], message);
    return;
  }
  if (action === 'duration' && parts.length === 0) {
    await beginSetupWizard(message.author, guildId, ['duration'], message);
    return;
  }

  const cfg = configForGuild(guildId);
  if (action === 'channel') {
    const rawChannel = parts.join(' ').trim().replace(/^<#(\d+)>$/, '$1').replace(/^#/, '');
    const guild = client.guilds.get(guildId);
    let channel = collectionValues(guild?.channels).find((candidate) => candidate.id === rawChannel)
      ?? collectionValues(guild?.channels).find((candidate) => String(candidate.name ?? '').toLowerCase() === rawChannel.toLowerCase());
    if (!channel && /^\d{15,22}$/.test(rawChannel)) {
      channel = await client.channels.fetch(rawChannel).catch(() => null);
    }
    const correctGuild = channel && (channel.guildId === guildId || channel.guild_id === guildId);
    const guildChannel = channel && (typeof channel.isGuild === 'function' ? channel.isGuild() : Boolean(correctGuild));
    const textChannel = channel && (typeof channel.isTextBased === 'function' ? channel.isTextBased() : [0, 5, 'GUILD_TEXT', 'GUILD_ANNOUNCEMENT', 'text', 'announcement'].includes(channel.type));
    if (!channel || !correctGuild || !guildChannel || !textChannel || (typeof channel.isThread === 'function' && channel.isThread())) {
      await privateResponse(message, t('setupChannelInvalid', {}, guildId));
      return;
    }
    await updateGuildSettings(guildId, { announcementChannelId: channel.id });
    await privateResponse(message, t('setupChannelSaved', { channelId: channel.id }, guildId));
    return;
  }

  if (action === 'timezone') {
    const rawZone = parts.join(' ').trim();
    const zone = resolveTimeZone(rawZone, guildId);
    if (!rawZone || !validTimeZone(zone)) {
      await privateResponse(message, t('zoneInvalid', { zone: rawZone || '(empty)' }, guildId));
      return;
    }
    await updateGuildSettings(guildId, { defaultTimeZone: zone });
    await privateResponse(message, t('setupZoneSaved', { zone }, guildId));
    return;
  }

  if (action === 'language') {
    const language = String(parts[0] ?? '').toLowerCase();
    if (!hasLocale(language)) {
      await privateResponse(message, t('setupLanguageInvalid', { languages: languageOptionsText(guildId) }, guildId));
      return;
    }
    await updateGuildSettings(guildId, { language });
    await privateResponse(message, t('setupLanguageSaved', { language }, guildId));
    return;
  }

  if (action === 'duration') {
    const duration = Number(parts[0]);
    if (!Number.isInteger(duration) || duration < 30 || duration > 720) {
      await privateResponse(message, t('setupDurationInvalid', {}, guildId));
      return;
    }
    await updateGuildSettings(guildId, { eventDurationMinutes: duration });
    await privateResponse(message, t('setupDurationSaved', { duration }, guildId));
    return;
  }

  await privateResponse(message, t('setupUsage', {}, guildId));
}

async function startSetupFromDm(message, input) {
  const parts = input.split(/\s+/).filter(Boolean);
  const actionRaw = (parts[0] ?? '').toLowerCase();
  const actionMap = new Map([
    ['канал', 'channel'], ['channel', 'channel'],
    ['зона', 'timezone'], ['часовойпояс', 'timezone'], ['timezone', 'timezone'], ['zone', 'timezone'],
    ['язык', 'language'], ['language', 'language'], ['lang', 'language'],
    ['длительность', 'duration'], ['duration', 'duration'],
  ]);
  const action = actionMap.get(actionRaw) ?? null;
  const steps = action ? [action] : SETUP_FLOW_STEPS;
  await sendGuildSelection(message.author, steps, message);
}

async function sendGuildSelection(user, steps, sourceMessage = null) {
  setupSessions.delete(user.id);
  const available = await findAdminGuilds(user.id);
  if (available.length === 0) {
    const text = t('setupWizardNoAdminServers', {}, null);
    await user.send(text).catch(() => {});
    if (sourceMessage?.guildId) await tryDeleteCommand(sourceMessage);
    return;
  }
  if (available.length === 1) {
    await beginSetupWizard(user, available[0].id, steps, sourceMessage);
    return;
  }
  const session = {
    userId: user.id,
    stage: 'selectGuild',
    guildOptions: available.map((guild) => ({ id: guild.id, name: guild.name })),
    steps,
    stepIndex: 0,
    expiresAt: Date.now() + SETUP_SESSION_TTL_MS,
    sourceMessage: sourceMessage ?? null,
  };
  setupSessions.set(user.id, session);
  const list = session.guildOptions.map((guild, index) => `${index + 1}. **${guild.name}**`).join('\n');
  await user.send(t('setupWizardSelectServer', { servers: list }, null));
  if (sourceMessage?.guildId) await tryDeleteCommand(sourceMessage);
}

async function findAdminGuilds(userId) {
  const candidates = collectionValues(client.guilds).filter((guild) => guild?.id && guild.available !== false);
  const permitted = [];
  for (const guild of candidates) {
    try {
      if (await isUserAdminInGuild(guild.id, userId)) permitted.push(guild);
    } catch (error) {
      logConsoleStyle('warn', `[Setup guild permission check failed for ${guild.id}]`, error?.message ?? error);
    }
  }
  return permitted.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
}

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === 'function') {
    try { return [...collection.values()]; } catch { /* Try the manager cache below. */ }
  }
  if (collection.cache && typeof collection.cache.values === 'function') {
    try { return [...collection.cache.values()]; } catch { /* Try object values below. */ }
  }
  if (typeof collection[Symbol.iterator] === 'function') {
    try { return [...collection]; } catch { /* Last resort. */ }
  }
  return Object.values(collection).filter((value) => value && typeof value === 'object');
}

async function isUserAdminInGuild(guildId, userId) {
  let guild = getCollectionItem(client.guilds, guildId)
    ?? getCollectionItem(client.guilds?.cache, guildId);
  if (!guild && typeof client.guilds?.fetch === 'function') {
    try {
      guild = await client.guilds.fetch(guildId);
    } catch (error) {
      logConsoleStyle('warn', '[Admin check guild fetch failed for ' + guildId + ']', error?.message ?? error);
      return false;
    }
  }
  if (!guild) return false;
  const ownerId = guild.ownerId ?? guild.owner_id;
  if (ownerId && String(ownerId) === String(userId)) return true;
  const member = await fetchGuildMember(guild, userId);
  return Boolean(member?.permissions?.has(PermissionFlags.ManageGuild)
    || member?.permissions?.has(PermissionFlags.Administrator)
    || (ownerId && String(ownerId) === String(userId)));
}

function listSetupChannels(guild, preferredChannelId = null, existingChannelId = null) {
  return collectionValues(guild?.channels)
    .filter((channel) => {
      if (!channel?.id) return false;
      const guildChannel = typeof channel.isGuild === 'function' ? channel.isGuild() : Boolean(channel.guildId ?? channel.guild_id);
      const textBased = typeof channel.isTextBased === 'function'
        ? channel.isTextBased()
        : [0, 5, 'GUILD_TEXT', 'GUILD_ANNOUNCEMENT', 'text', 'announcement'].includes(channel.type);
      const isThread = typeof channel.isThread === 'function' ? channel.isThread() : [10, 11, 12, 'GUILD_PUBLIC_THREAD', 'GUILD_PRIVATE_THREAD', 'GUILD_NEWS_THREAD'].includes(channel.type);
      return guildChannel && textBased && !isThread;
    })
    .sort((a, b) => {
      // When launched from a server channel, put that channel first; otherwise prefer the saved destination.
      const rank = (channel) => channel.id === preferredChannelId ? 0 : channel.id === existingChannelId ? 1 : 2;
      return rank(a) - rank(b) || String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
}

async function beginSetupWizard(user, guildId, steps = SETUP_FLOW_STEPS, sourceMessage = null) {
  const guild = client.guilds.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
  if (!guild || !(await isUserAdminInGuild(guildId, user.id))) {
    await user.send(t('adminOnly', {}, guildId)).catch(() => {});
    return;
  }
  const session = {
    userId: user.id,
    guildId,
    guildName: guild.name ?? 'Server',
    stage: 'wizard',
    steps: [...steps],
    stepIndex: 0,
    channelOptions: listSetupChannels(
      guild,
      sourceMessage?.guildId === guildId ? sourceMessage.channelId : null,
      configForGuild(guildId).announcementChannelId,
    ),
    expiresAt: Date.now() + SETUP_SESSION_TTL_MS,
    sourceMessage: sourceMessage ?? null,
  };
  setupSessions.set(user.id, session);
  try {
    await user.send(t('setupWizardIntro', { guild: session.guildName }, guildId));
    await promptSetupStep(user, session);
  } catch (error) {
    setupSessions.delete(user.id);
    logConsoleStyle('warn', '[Setup wizard DM failed]', error?.message ?? error);
    if (sourceMessage) await privateResponse(sourceMessage, t('dmFailed', {}, guildId));
    return;
  }
  if (sourceMessage?.guildId) await tryDeleteCommand(sourceMessage);
}

async function promptSetupStep(user, session) {
  session.expiresAt = Date.now() + SETUP_SESSION_TTL_MS;
  if (session.stepIndex >= session.steps.length) {
    setupSessions.delete(user.id);
    const cfg = configForGuild(session.guildId);
    const channel = cfg.announcementChannelId ? `<#${cfg.announcementChannelId}>` : (langForGuild(session.guildId) === 'ru' ? 'не настроен' : 'not set');
    await user.send(t('setupWizardComplete', {
      channel, zone: cfg.defaultTimeZone, language: cfg.language,
      duration: cfg.eventDurationMinutes,
    }, session.guildId));
    return;
  }

  const step = session.steps[session.stepIndex];
  const cfg = configForGuild(session.guildId);
  const currentChannel = cfg.announcementChannelId ? `<#${cfg.announcementChannelId}>` : (langForGuild(session.guildId) === 'ru' ? 'не настроен' : 'not set');
  if (step === 'channel') {
    const channels = session.channelOptions.slice(0, 25);
    const list = channels.length
      ? channels.map((channel, index) => `${index + 1}. #${channel.name}`).join('\n')
      : (langForGuild(session.guildId) === 'ru' ? 'Список каналов недоступен — можно ввести ID канала.' : 'Channel list unavailable — you can enter a channel ID.');
    await user.send(t('setupWizardAskChannel', { channels: list, current: currentChannel }, session.guildId));
  } else if (step === 'timezone') {
    await user.send(t('setupWizardAskTimezone', { zone: cfg.defaultTimeZone }, session.guildId));
  } else if (step === 'language') {
    await user.send(t('setupWizardAskLanguage', { language: cfg.language, languages: languageOptionsText(session.guildId) }, session.guildId));
  } else if (step === 'duration') {
    await user.send(t('setupWizardAskDuration', { duration: cfg.eventDurationMinutes }, session.guildId));
  }
}

async function handleSetupWizardAnswer(message, rawAnswer) {
  const session = setupSessions.get(message.author.id);
  if (!session) return;
  if (Date.now() > session.expiresAt) {
    setupSessions.delete(message.author.id);
    await message.author.send(t('setupWizardExpired', {}, session.guildId ?? null));
    return;
  }
  const answer = String(rawAnswer ?? '').trim();
  const normalized = answer.toLowerCase();
  if (session.guildId && session.stage === 'wizard'
    && !(await isUserAdminInGuild(session.guildId, message.author.id).catch(() => false))) {
    setupSessions.delete(message.author.id);
    await message.author.send(t('adminOnly', {}, session.guildId)).catch(() => {});
    return;
  }
  if (['cancel', 'отмена', 'стоп', 'stop'].includes(normalized)) {
    setupSessions.delete(message.author.id);
    await message.author.send(t('setupWizardCancelled', {}, session.guildId ?? null));
    return;
  }

  if (session.stage === 'selectGuild') {
    const selected = Number(answer);
    if (!Number.isInteger(selected) || selected < 1 || selected > session.guildOptions.length) {
      await message.author.send(t('setupWizardBadServer', {}, null));
      return;
    }
    const selectedGuild = session.guildOptions[selected - 1];
    if (!(await isUserAdminInGuild(selectedGuild.id, message.author.id))) {
      setupSessions.delete(message.author.id);
      await message.author.send(t('adminOnly', {}, null));
      return;
    }
    await beginSetupWizard(message.author, selectedGuild.id, session.steps, session.sourceMessage);
    return;
  }

  const step = session.steps[session.stepIndex];
  const cfg = configForGuild(session.guildId);
  const skipWords = ['skip', 'later', 'пропустить', 'позже', 'оставить'];
  if (skipWords.includes(normalized)) {
    if (step === 'channel' && !cfg.announcementChannelId) {
      await message.author.send(t('setupWizardChannelRequired', {}, session.guildId));
      await promptSetupStep(message.author, session);
      return;
    }
    await message.author.send(t('setupWizardSkipped', {}, session.guildId));
    session.stepIndex += 1;
    await promptSetupStep(message.author, session);
    return;
  }

  if (step === 'channel') {
    const rawChannel = answer.replace(/^<#(\d+)>$/, '$1').replace(/^#/, '').trim();
    const byNumber = /^\d+$/.test(rawChannel) ? session.channelOptions[Number(rawChannel) - 1] : null;
    let channel = byNumber ?? session.channelOptions.find((candidate) => candidate.id === rawChannel)
      ?? session.channelOptions.find((candidate) => String(candidate.name ?? '').toLowerCase() === rawChannel.toLowerCase());
    if (!channel && /^\d{15,22}$/.test(rawChannel)) {
      channel = await client.channels.fetch(rawChannel).catch(() => null);
    }
    const correctGuild = channel && (channel.guildId === session.guildId || channel.guild_id === session.guildId);
    const canPost = channel && (typeof channel.isTextBased === 'function' ? channel.isTextBased() : true)
      && (typeof channel.isGuild === 'function' ? channel.isGuild() : Boolean(correctGuild));
    if (!channel || !correctGuild || !canPost) {
      await message.author.send(t('setupWizardChannelInvalid', {}, session.guildId));
      await promptSetupStep(message.author, session);
      return;
    }
    await updateGuildSettings(session.guildId, { announcementChannelId: channel.id });
    await message.author.send(t('setupWizardSaved', { setting: t('setupWizardChannelSaved', {}, session.guildId) }, session.guildId));
  } else if (step === 'timezone') {
    const zone = resolveTimeZone(answer, session.guildId);
    if (!validTimeZone(zone)) {
      await message.author.send(t('setupWizardTimezoneInvalid', { zone: cfg.defaultTimeZone }, session.guildId));
      await promptSetupStep(message.author, session);
      return;
    }
    await updateGuildSettings(session.guildId, { defaultTimeZone: zone });
    await message.author.send(t('setupWizardSaved', { setting: t('setupWizardZoneSaved', {}, session.guildId) }, session.guildId));
  } else if (step === 'language') {
    const language = normalized;
    if (!hasLocale(language)) {
      await message.author.send(t('setupWizardAskLanguage', { language: cfg.language, languages: languageOptionsText(session.guildId) }, session.guildId));
      return;
    }
    await updateGuildSettings(session.guildId, { language });
    await message.author.send(t('setupWizardSaved', { setting: t('setupWizardLanguageSaved', {}, session.guildId) }, session.guildId));
  } else if (step === 'duration') {
    const duration = Number(answer);
    if (!Number.isInteger(duration) || duration < 30 || duration > 720) {
      await message.author.send(t('setupWizardDurationInvalid', {}, session.guildId));
      await promptSetupStep(message.author, session);
      return;
    }
    await updateGuildSettings(session.guildId, { eventDurationMinutes: duration });
    await message.author.send(t('setupWizardSaved', { setting: t('setupWizardDurationSaved', {}, session.guildId) }, session.guildId));
  }

  session.stepIndex += 1;
  session.expiresAt = Date.now() + SETUP_SESSION_TTL_MS;
  await promptSetupStep(message.author, session);
}

async function tryDeleteCommand(message) {
  if (typeof message?.delete !== 'function') return;
  try { await message.delete(); } catch { /* Delete permission is optional. */ }
}

async function isServerAdmin(message) {
  try {
    return await isUserAdminInGuild(message.guildId, message.author.id);
  } catch (error) {
    logConsoleStyle('warn', '[Admin permission check failed]', error?.message ?? error);
    return false;
  }
}

async function myZoneCommand(message, rawZone, guildId = message.guildId) {
  const input = rawZone.trim();
  const current = getUserTimeZone(guildId, message.author.id);
  if (!input) {
    const currentLabel = current ?? configForGuild(guildId).defaultTimeZone;
    await privateResponse(message, t('myZoneCurrent', { zone: currentLabel }, guildId));
    return;
  }
  if (['default', 'по умолчанию', 'reset', 'сброс'].includes(input.toLowerCase())) {
    await setUserTimeZone(guildId, message.author.id, null);
    await privateResponse(message, t('myZoneReset', {}, guildId));
    return;
  }
  const zone = resolveTimeZone(input, guildId);
  if (!validTimeZone(zone)) {
    await privateResponse(message, `${t('zoneInvalid', { zone: input }, guildId)}\n${t('myZoneUsage', {}, guildId)}`);
    return;
  }
  await setUserTimeZone(guildId, message.author.id, zone);
  await privateResponse(message, t('myZoneSaved', { zone }, guildId));
}

async function languageSupportCommand(message, rawArguments, guildId) {
  const parts = String(rawArguments ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const action = parts[0] ?? 'help';
  const languageNames = availableLocales().map((code) => `${code} (${translateText(code, 'languageName')})`).join(', ');
  const requestUrl = safeConfiguredFormUrl(process.env.LANGUAGE_REQUEST_FORM_URL);
  const submissionUrl = safeConfiguredFormUrl(process.env.LANGUAGE_SUBMISSION_FORM_URL);

  if (['help', 'list', 'список', 'помощь'].includes(action)) {
    await privateResponse(message, t('languageSupportInfo', { languages: languageNames }, guildId));
    return;
  }
  if (['request', 'запрос', 'запросить', 'нужен'].includes(action)) {
    const response = requestUrl
      ? t('languageRequestFormReady', { url: requestUrl }, guildId)
      : t('languageRequestFormMissing', {}, guildId);
    await privateResponse(message, response);
    return;
  }
  if (['submit', 'contribute', 'предложить', 'отправить', 'добавить'].includes(action)) {
    const response = submissionUrl
      ? t('languageSubmissionFormReady', { url: submissionUrl }, guildId)
      : t('languageSubmissionFormMissing', {}, guildId);
    await privateResponse(message, response);
    return;
  }
  await privateResponse(message, t('languageSupportUsage', {}, guildId));
}

function safeConfiguredFormUrl(rawValue) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function startEventCreationWizard(message, guildId) {
  const config = configForGuild(guildId);
  if (!config.announcementChannelId) {
    await privateResponse(message, t('noChannelConfigured', {}, guildId));
    return;
  }

  setupSessions.delete(message.author.id);
  hostManageSessions.delete(message.author.id);
  dmGuildSelectionSessions.delete(message.author.id);
  setDmGuildContext(dmGuildContexts, message.author.id, guildId, { pinned: true });

  const session = {
    guildId,
    steps: [...EVENT_CREATE_STEPS],
    stepIndex: 0,
    values: {
      dateTime: '',
      timeZone: config.defaultTimeZone,
      maxAttendees: null,
      recurrence: { ok: true, frequency: null, count: 1 },
      durationMinutes: config.eventDurationMinutes,
      durationWasDefaulted: false,
      notifyOnStart: false,
      title: '',
      description: '',
    },
    expiresAt: Date.now() + EVENT_CREATE_SESSION_TTL_MS,
  };
  eventCreateSessions.set(message.author.id, session);

  try {
    await message.author.send(t('createWizardIntro', {}, guildId));
    await promptEventCreateWizardStep(message.author, session);
    if (message.guildId) await tryDeleteCommand(message);
  } catch (error) {
    eventCreateSessions.delete(message.author.id);
    clearDmGuildContext(dmGuildContexts, message.author.id);
    logConsoleStyle('warn', '[Event creation wizard DM failed]', error?.message ?? error);
    if (message.guildId) {
      await privateResponse(message, t('dmFailed', {}, guildId), { deleteCommand: false });
    } else {
      await message.author.send(t('dmFailed', {}, guildId)).catch(() => {});
    }
  }
}

async function promptEventCreateWizardStep(user, session) {
  session.expiresAt = Date.now() + EVENT_CREATE_SESSION_TTL_MS;
  const guildId = session.guildId;
  const values = session.values;
  const step = session.steps[session.stepIndex];

  if (step === 'dateTime') {
    await user.send(t('createWizardAskDate', {}, guildId));
  } else if (step === 'timeZone') {
    await user.send(t('createWizardAskTimezone', { zone: values.timeZone }, guildId));
  } else if (step === 'limit') {
    const current = values.maxAttendees === null ? t('cardNoLimit', {}, guildId) : String(values.maxAttendees);
    await user.send(t('createWizardAskLimit', { current }, guildId));
  } else if (step === 'repeat') {
    const current = values.recurrence.count > 1
      ? `${values.recurrence.frequency}:${values.recurrence.count}`
      : t('createWizardOnce', {}, guildId);
    await user.send(t('createWizardAskRepeat', { current }, guildId));
  } else if (step === 'duration') {
    await user.send(t('createWizardAskDuration', { duration: values.durationMinutes }, guildId));
  } else if (step === 'notifyOnStart') {
    await user.send(t('createWizardAskNotify', { current: values.notifyOnStart ? 'yes' : 'no' }, guildId));
  } else if (step === 'title') {
    await user.send(t('createWizardAskTitle', { current: values.title || '—' }, guildId));
  } else if (step === 'description') {
    await user.send(t('createWizardAskDescription', { current: values.description || '—' }, guildId));
  } else if (step === 'confirm') {
    const zonedStart = DateTime.fromFormat(values.dateTime, 'yyyy-MM-dd HH:mm', {
      zone: values.timeZone,
      setZone: true,
      locale: localeForGuild(guildId),
      numberingSystem: 'latn',
    });
    const limit = values.maxAttendees === null ? t('cardNoLimit', {}, guildId) : String(values.maxAttendees);
    const repeat = values.recurrence.count > 1
      ? `${values.recurrence.frequency}:${values.recurrence.count}`
      : t('createWizardOnce', {}, guildId);
    const preview = t('createWizardPreview', {
      title: values.title,
      when: zonedStart.isValid ? formatShortDateTime(zonedStart, guildId) : values.dateTime,
      zone: values.timeZone,
      limit,
      repeat,
      duration: values.durationMinutes,
      notify: values.notifyOnStart ? t('createWizardNotifyYes', {}, guildId) : t('createWizardNotifyNo', {}, guildId),
      description: values.description || t('noDescription', {}, guildId),
    }, guildId);
    await user.send(`${preview}\n\n${t('createWizardConfirm', {}, guildId)}\n\n${t('createWizardBackHint', {}, guildId)}`);
  }
}

async function handleEventCreateWizardAnswer(message, rawInput) {
  const userId = message.author.id;
  const session = eventCreateSessions.get(userId);
  if (!session) return;

  if (session.expiresAt <= Date.now()) {
    eventCreateSessions.delete(userId);
    clearDmGuildContext(dmGuildContexts, userId);
    await message.author.send(t('createWizardExpired', {}, session.guildId));
    return;
  }

  if (!(await isUserMemberInGuild(session.guildId, userId))) {
    eventCreateSessions.delete(userId);
    clearDmGuildContext(dmGuildContexts, userId);
    await message.author.send(t('dmServerNotMember', { guild: session.guildId }, null));
    return;
  }

  const guildId = session.guildId;
  const input = String(rawInput ?? '').trim();
  const normalized = input.toLowerCase();
  const step = session.steps[session.stepIndex];

  if (['cancel', 'отмена', 'стоп', 'stop'].includes(normalized)) {
    eventCreateSessions.delete(userId);
    clearDmGuildContext(dmGuildContexts, userId);
    await message.author.send(t('createWizardCancelled', {}, guildId));
    return;
  }

  if (['back', 'назад'].includes(normalized)) {
    if (session.stepIndex === 0) {
      await message.author.send(t('createWizardFirstStep', {}, guildId));
      return;
    }
    session.stepIndex -= 1;
    await promptEventCreateWizardStep(message.author, session);
    return;
  }

  const skip = ['', 'skip', 'default', 'по умолчанию', 'пропустить'].includes(normalized);

  if (step === 'dateTime') {
    const dateTime = normalizeLocalDateTimeInput(input);
    if (!dateTime) {
      await message.author.send(t('dateInvalid', {}, guildId));
      return;
    }
    session.values.dateTime = dateTime;
  } else if (step === 'timeZone') {
    const timeZone = skip ? configForGuild(guildId).defaultTimeZone : resolveTimeZone(input, guildId);
    if (!validTimeZone(timeZone)) {
      await message.author.send(t('zoneInvalid', { zone: input }, guildId));
      return;
    }
    const zonedStart = DateTime.fromFormat(session.values.dateTime, 'yyyy-MM-dd HH:mm', {
      zone: timeZone,
      setZone: true,
      locale: localeForGuild(guildId),
      numberingSystem: 'latn',
    });
    if (!zonedStart.isValid || zonedStart.toFormat('yyyy-MM-dd HH:mm') !== session.values.dateTime) {
      await message.author.send(t('nonexistentTime', { zone: timeZone }, guildId));
      return;
    }
    if (zonedStart.toMillis() <= Date.now() + 60_000) {
      await message.author.send(t('timePast', {}, guildId));
      return;
    }
    session.values.timeZone = timeZone;
  } else if (step === 'limit') {
    if (skip || ['none', '-', 'no limit', 'без лимита', 'безлимит'].includes(normalized)) {
      session.values.maxAttendees = null;
    } else {
      const limit = Number(input);
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        await message.author.send(t('limitInvalid', {}, guildId));
        return;
      }
      session.values.maxAttendees = limit;
    }
  } else if (step === 'repeat') {
    const recurrence = parseRecurrence(skip ? '1' : input);
    if (!recurrence.ok) {
      await message.author.send(t('repeatInvalid', {}, guildId));
      return;
    }
    session.values.recurrence = recurrence;
  } else if (step === 'duration') {
    const resolved = skip
      ? { minutes: configForGuild(guildId).eventDurationMinutes, defaulted: false }
      : resolveDurationMinutes(input, configForGuild(guildId).eventDurationMinutes);
    session.values.durationMinutes = resolved.minutes;
    session.values.durationWasDefaulted = resolved.defaulted;
    if (resolved.defaulted) {
      await message.author.send(t('createDurationDefaulted', { duration: resolved.minutes }, guildId));
    }
  } else if (step === 'notifyOnStart') {
    const notify = skip ? false : parseOptionalBoolean(input);
    if (notify === null) {
      await message.author.send(t('createNotifyInvalid', {}, guildId));
      return;
    }
    session.values.notifyOnStart = notify;
  } else if (step === 'title') {
    if (!input || input.length > 100) {
      await message.author.send(t('titleInvalid', {}, guildId));
      return;
    }
    session.values.title = input;
  } else if (step === 'description') {
    const description = skip || input === '-' ? '' : input;
    if (description.length > 700) {
      await message.author.send(t('descriptionInvalid', {}, guildId));
      return;
    }
    session.values.description = description;
  } else if (step === 'confirm') {
    if (['yes', 'y', 'да', 'confirm', 'publish', 'создать'].includes(normalized)) {
      const zonedStart = DateTime.fromFormat(session.values.dateTime, 'yyyy-MM-dd HH:mm', {
        zone: session.values.timeZone,
        setZone: true,
        locale: localeForGuild(guildId),
        numberingSystem: 'latn',
      });
      if (!zonedStart.isValid || zonedStart.toMillis() <= Date.now() + 60_000) {
        await message.author.send(t('timePast', {}, guildId));
        session.stepIndex = 0;
        await promptEventCreateWizardStep(message.author, session);
        return;
      }
      eventCreateSessions.delete(userId);
      try {
        await publishEventSeries(message, guildId, {
          title: session.values.title,
          description: session.values.description,
          zonedStart,
          timeZone: session.values.timeZone,
          maxAttendees: session.values.maxAttendees,
          recurrence: session.values.recurrence,
          durationMinutes: session.values.durationMinutes,
          durationWasDefaulted: session.values.durationWasDefaulted,
          notifyOnStart: session.values.notifyOnStart,
        });
      } finally {
        clearDmGuildContext(dmGuildContexts, userId);
      }
      return;
    }
    if (['no', 'n', 'нет', 'abort', 'отменить'].includes(normalized)) {
      eventCreateSessions.delete(userId);
      clearDmGuildContext(dmGuildContexts, userId);
      await message.author.send(t('createWizardCancelled', {}, guildId));
      return;
    }
    await message.author.send(t('createWizardConfirm', {}, guildId));
    return;
  }

  session.stepIndex += 1;
  session.expiresAt = Date.now() + EVENT_CREATE_SESSION_TTL_MS;
  await promptEventCreateWizardStep(message.author, session);
}

async function createEventSeries(message, rawArguments, guildId = message.guildId) {
  const raw = String(rawArguments ?? '').trim().replace(/^\|/, '').trim();
  const fields = raw.split('|').map((field) => field.trim());
  if (fields.length < 6 || fields.length > 8) {
    await replyCreateError(message, t('createUsage', {}, guildId), guildId);
    return;
  }
  const [title, dateInput, rawTimeZone, maxInput, descriptionInput, repeatInput] = fields;
  let durationInput = fields[6];
  let notifyStartInput = fields[7];
  if (fields.length === 7 && ['yes', 'no', 'да', 'нет', 'true', 'false', 'on', 'off'].includes(String(fields[6] ?? '').toLowerCase())) {
    notifyStartInput = fields[6];
    durationInput = '';
  }
  const description = descriptionInput === '-' ? '' : descriptionInput;
  const timeZone = resolveTimeZone(rawTimeZone, guildId);
  const config = configForGuild(guildId);
  const { minutes: durationMinutes, defaulted: durationWasDefaulted } = resolveDurationMinutes(durationInput, config.eventDurationMinutes);
  const notifyOnStart = parseOptionalBoolean(notifyStartInput);
  if (notifyOnStart === null) {
    await replyCreateError(message, t('createNotifyInvalid', {}, guildId), guildId);
    return;
  }
  if (!title || title.length > 100) {
    await replyCreateError(message, t('titleInvalid', {}, guildId), guildId);
    return;
  }
  if (description.length > 700) {
    await replyCreateError(message, t('descriptionInvalid', {}, guildId), guildId);
    return;
  }
  if (!rawTimeZone || !validTimeZone(timeZone)) {
    await replyCreateError(message, t('zoneInvalid', { zone: rawTimeZone }, guildId), guildId);
    return;
  }
  const normalizedDateInput = normalizeLocalDateTimeInput(dateInput);
  if (!normalizedDateInput) {
    await replyCreateError(message, t('dateInvalid', {}, guildId), guildId);
    return;
  }
  const zonedStart = DateTime.fromFormat(normalizedDateInput, 'yyyy-MM-dd HH:mm', {
    zone: timeZone,
    setZone: true,
    locale: localeForGuild(guildId),
    numberingSystem: 'latn',
  });
  if (!zonedStart.isValid) {
    await replyCreateError(message, t('dateInvalid', {}, guildId), guildId);
    return;
  }
  if (zonedStart.toFormat('yyyy-MM-dd HH:mm') !== normalizedDateInput) {
    await replyCreateError(message, t('nonexistentTime', { zone: timeZone }, guildId), guildId);
    return;
  }
  if (zonedStart.toMillis() <= Date.now() + 60_000) {
    await replyCreateError(message, t('timePast', {}, guildId), guildId);
    return;
  }
  let maxAttendees = null;
  if (maxInput && !['none', '-', 'без лимита', 'безлимит', 'no limit'].includes(maxInput.toLowerCase())) {
    const parsedLimit = Number(maxInput);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      await replyCreateError(message, t('limitInvalid', {}, guildId), guildId);
      return;
    }
    maxAttendees = parsedLimit;
  }
  const recurrence = parseRecurrence(repeatInput);
  if (!recurrence.ok) {
    await replyCreateError(message, t('repeatInvalid', {}, guildId), guildId);
    return;
  }
  await publishEventSeries(message, guildId, {
    title, description, zonedStart, timeZone, maxAttendees, recurrence,
    durationMinutes, durationWasDefaulted, notifyOnStart,
  });
}

async function publishEventSeries(message, guildId, {
  title, description, zonedStart, timeZone, maxAttendees, recurrence,
  durationMinutes, durationWasDefaulted = false, notifyOnStart = false,
}) {
  const config = configForGuild(guildId);
  if (!config.announcementChannelId) {
    await privateResponse(message, t('noChannelConfigured', {}, guildId));
    return;
  }
  let announcementChannel;
  try {
    announcementChannel = await client.channels.fetch(config.announcementChannelId);
  } catch (error) {
    logConsoleStyle('warn', '[Announcement channel fetch failed]', error?.message ?? error);
  }
  if (!announcementChannel?.isGuild?.() || !announcementChannel?.isTextBased?.()) {
    await privateResponse(message, t('createFailed', {}, guildId));
    return;
  }

  const seriesId = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const occurrences = [];
  for (let index = 0; index < recurrence.count; index += 1) {
    let occurrenceStart = zonedStart;
    if (index > 0) {
      if (recurrence.frequency === 'daily') occurrenceStart = zonedStart.plus({ days: index });
      if (recurrence.frequency === 'weekly') occurrenceStart = zonedStart.plus({ weeks: index });
      if (recurrence.frequency === 'monthly') occurrenceStart = zonedStart.plus({ months: index });
    }
    occurrences.push({
      id: newEventId(),
      seriesId,
      seriesIndex: index + 1,
      seriesCount: recurrence.count,
      recurrenceFrequency: recurrence.frequency,
      title,
      description,
      startsAt: occurrenceStart.toUTC().toISO({ suppressMilliseconds: true }),
      timeZone,
      maxAttendees,
      attendees: [],
      remindersSent: [],
      reminderDeliveries: {},
      guildId,
      channelId: config.announcementChannelId,
      messageId: null,
      creatorId: message.author.id,
      creatorName: message.author.username ?? 'Unknown host',
      durationMinutes,
      notifyOnStart,
      status: 'scheduled',
      createdAt: DateTime.utc().toISO({ suppressMilliseconds: true }),
    });
  }

  await addEvents(occurrences);
  const first = occurrences[0];
  const published = await publishEventPost(first);
  if (!published) {
    await privateResponse(message, t('createFailed', {}, guildId));
    return;
  }

  const timeLabel = formatPersonalTime(first, message.author.id);
  const confirmation = recurrence.count > 1
    ? t('createdMany', { count: recurrence.count, title, id: first.id, when: timeLabel }, guildId)
    : t('createdOne', { title, id: first.id, when: timeLabel }, guildId);
  const manageHint = t('hostManageCommandHint', { id: first.id, command: manageCommandForGuild(guildId) }, guildId);
  const durationNote = durationWasDefaulted ? `\n\n${t('createDurationDefaulted', { duration: durationMinutes }, guildId)}` : '';
  const startNoticeNote = notifyOnStart ? `\n${t('createStartNoticeEnabled', {}, guildId)}` : '';
  const delivered = await privateResponse(message, `${confirmation}\n\n${t('createNote', {}, guildId)}${durationNote}${startNoticeNote}\n\n${manageHint}`);
  if (delivered) setupSessions.delete(message.author.id);
}

function parseOptionalBoolean(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (['yes', 'y', 'true', 'on', 'enable', 'enabled', 'да', 'д'].includes(normalized)) return true;
  if (['no', 'n', 'false', 'off', 'disable', 'disabled', 'нет', 'н'].includes(normalized)) return false;
  return null;
}

async function replyCreateError(message, content, guildId = message.guildId) {
  const originalCommand = String(message.content ?? '');
  const preservedText = `${t('createCommandPreserved', {}, guildId)}\n${originalCommand}`;

  if (!message.guildId) {
    await safeReply(message, content);
    await safeReply(message, preservedText);
    return;
  }

  try {
    await message.author.send(content);
    await message.author.send(preservedText);
    await tryDeleteCommand(message);
  } catch (error) {
    logConsoleStyle('warn', '[Could not DM event creation correction]', error?.message ?? error);
    try {
      await safeReply(message, t('dmFailed', {}, message.guildId));
    } catch (replyError) {
      logConsoleStyle('error', '[Event creation correction fallback failed]', replyError?.message ?? replyError);
    }
  }
}

function parseRecurrence(input) {
  const value = String(input ?? '').trim().toLowerCase();
  if (!value || ['1', 'none', '-', 'один раз', 'без повтора', 'once'].includes(value)) {
    return { ok: true, frequency: null, count: 1 };
  }
  const match = value.match(/^(daily|weekly|monthly|ежедневно|еженедельно|ежемесячно):(\d{1,2})$/);
  if (!match) return { ok: false };
  const frequencyAliases = new Map([
    ['ежедневно', 'daily'], ['еженедельно', 'weekly'], ['ежемесячно', 'monthly'],
  ]);
  const frequency = frequencyAliases.get(match[1]) ?? match[1];
  const count = Number(match[2]);
  if (!Number.isInteger(count) || count < 2 || count > MAX_SERIES_OCCURRENCES) return { ok: false };
  return { ok: true, frequency, count };
}

async function listEvents(message, guildId = message.guildId) {
  const upcoming = getUpcomingEvents(allEvents(), guildId, Date.now(), 12);
  if (upcoming.length === 0) {
    await privateResponse(message, t('noUpcoming', {}, guildId));
    return;
  }

  const guild = getCollectionItem(client.guilds, guildId) ?? getCollectionItem(client.guilds?.cache, guildId);
  const channel = configForGuild(guildId).announcementChannelId;
  const header = t('dmEventLocation', {
    guild: guild?.name ?? guildId,
    channel: channel ? '<#' + channel + '>' : t('dmUnknownChannel', {}, guildId),
  }, guildId);
  const lines = upcoming.map((event) => {
    const attendees = getEventAttendees(event);
    const yesCount = attendees.filter((attendee) => attendee.status === 'yes').length;
    const rawLimit = Number(event.maxAttendees);
    const hasLimit = Number.isInteger(rawLimit) && rawLimit > 0;
    const spots = hasLimit
      ? yesCount + '/' + rawLimit
      : yesCount + ' · ' + (langForGuild(guildId) === 'ru' ? 'без лимита' : 'no limit');
    let when = String(event.startsAt);
    try {
      when = formatPersonalTime(event, message.author.id).replaceAll('\n', ' · ');
    } catch (error) {
      logConsoleStyle('warn', '[Event list time formatting failed for ' + String(event.id ?? 'unknown') + ']', error?.message ?? error);
    }
    return t('upcomingLine', {
      title: String(event.title ?? 'Untitled event').slice(0, 100),
      id: String(event.id ?? 'unknown'),
      when,
      spots,
    }, guildId);
  });
  await privateResponse(message, header + '\n\n' + t('upcomingTitle', {}, guildId) + '\n' + lines.join('\n') + '\n\n' + t('upcomingFooter', {}, guildId));
}
async function showEventInfo(message, idInput, guildId = message.guildId) {
  const event = findGuildEvent(idInput, guildId);
  if (!event || !event.messageId) {
    await privateResponse(message, t('noEvent', {}, guildId));
    return;
  }
  await privateResponse(message, renderEventDetails(event, message.author.id));
}

async function commandRsvp(message, rawArguments, guildId = message.guildId) {
  const [idInput, statusInput] = rawArguments.split(/\s+/).filter(Boolean);
  const statusMap = new Map([
    ['yes', 'yes'], ['да', 'yes'], ['иду', 'yes'],
    ['maybe', 'maybe'], ['возможно', 'maybe'], ['можетбыть', 'maybe'],
    ['no', 'no'], ['нет', 'no'], ['неиду', 'no'],
  ]);
  const status = statusMap.get((statusInput ?? '').toLowerCase());
  if (!idInput || !status) {
    await privateResponse(message, t('rsvpUsage', {}, guildId));
    return;
  }

  const event = findGuildEvent(idInput, guildId);
  if (!event || !event.messageId) {
    await privateResponse(message, t('noEvent', {}, guildId));
    return;
  }
  if (event.status !== 'scheduled' || isEventStarted(event)) {
    await privateResponse(message, t('rsvpClosed', {}, guildId));
    return;
  }

  const result = changeRsvp(event, message.author.id, message.author.username ?? 'Unknown attendee', status);
  if (!result.ok) {
    await privateResponse(message, result.reason);
    return;
  }

  await saveEvents([event]);
  await refreshEventPost(event);
  const personalizedConfirmation = result.confirmation.includes('{when}')
    ? result.confirmation.replace('{when}', formatPersonalTime(event, message.author.id))
    : result.confirmation;
  await privateResponse(message, personalizedConfirmation);
}

async function cancelEvent(message, idInput, guildId = message.guildId) {
  const event = findGuildEvent(idInput, guildId);
  if (!event || !event.messageId) {
    await privateResponse(message, t('noEvent', {}, guildId));
    return;
  }
  const requesterIsAdmin = Boolean(message.guildId && event.creatorId !== message.author.id && await isServerAdmin(message));
  if (!canManageEvent(event, { userId: message.author.id, guildId: message.guildId ?? null, isAdmin: requesterIsAdmin })) {
    await privateResponse(message, t('onlyCreator', {}, guildId));
    return;
  }
  if (event.status === 'cancelled') {
    await privateResponse(message, t('alreadyCancelled', {}, guildId));
    return;
  }

  event.status = 'cancelled';
  await saveEvents([event]);
  await refreshEventPost(event);
  await notifyInterestedMembers(event, t('noticeCancelled', { title: event.title }, event.guildId));
  await privateResponse(message, t('cancelled', { title: event.title }, guildId));
  if (event.seriesId) await ensureUpcomingAnnouncement(event.seriesId);
}

function changeRsvp(event, userId, username, status) {
  event.attendees ??= [];
  const existing = event.attendees.find((attendee) => attendee.userId === userId);
  const guildId = event.guildId;

  if (status === 'no') {
    event.attendees = event.attendees.filter((attendee) => attendee.userId !== userId);
    return {
      ok: true,
      confirmation: existing ? t('rsvpRemoved', { title: event.title }, guildId) : t('rsvpAbsent', { title: event.title }, guildId),
    };
  }

  const yesCount = event.attendees.filter((attendee) => attendee.status === 'yes').length;
  if (status === 'yes' && existing?.status !== 'yes' && event.maxAttendees !== null && yesCount >= event.maxAttendees) {
    return { ok: false, reason: t('atCapacity', { title: event.title, limit: event.maxAttendees }, guildId) };
  }

  if (existing) {
    existing.status = status;
    existing.username = username || existing.username;
  } else {
    event.attendees.push({ userId, username: username || 'Unknown attendee', status });
  }

  return {
    ok: true,
    confirmation: status === 'yes'
      ? t('rsvpYes', { title: event.title, when: '{when}' }, guildId)
      : t('rsvpMaybe', { title: event.title, when: '{when}' }, guildId),
  };
}

function manageCommandForGuild(guildId) {
  return langForGuild(guildId) === 'ru' ? '!событие управление' : '!event manage';
}

async function notifyHostOccurrencePublished(event) {
  const command = manageCommandForGuild(event.guildId);
  const content = `${t('hostOccurrencePublished', { title: event.title, id: event.id }, event.guildId)}\n${t('hostManageCommandHint', { id: event.id, command }, event.guildId)}`;
  let delivered = false;
  try {
    const host = await client.users.fetch(event.creatorId);
    await host.send(content);
    delivered = true;
  } catch (error) {
    logConsoleStyle('warn', `[Next occurrence DM failed for event ${event.id}]`, error?.message ?? error);
    try {
      const channel = await client.channels.fetch(event.channelId);
      if (channel?.isTextBased?.()) {
        await channel.send({
          content: `${content}\n${t('hostManageDmFallbackShort', {}, event.guildId)} <@${event.creatorId}>`,
          allowedMentions: { parse: [], users: [event.creatorId] },
        });
        delivered = true;
      }
    } catch (fallbackError) {
      logConsoleStyle('error', `[Next occurrence fallback failed for event ${event.id}]`, fallbackError?.message ?? fallbackError);
    }
  }
  if (delivered) {
    event.hostPublishNoticePending = false;
    event.hostPublishNoticeSentAt = DateTime.utc().toISO({ suppressMilliseconds: true });
    await saveEvents([event]);
  }
  return delivered;
}

async function retryPendingHostOccurrenceNotices() {
  for (const event of allEvents()) {
    if (event.hostPublishNoticePending && event.messageId && !['cancelled', 'completed', 'skipped'].includes(event.status)) {
      await notifyHostOccurrencePublished(event);
    }
  }
}

function renderHostManageMenu(event, userId) {
  return t('hostManageMenu', {
    title: event.title,
    id: event.id,
    when: formatPersonalTime(event, userId),
    duration: formatDuration(event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES, event.guildId),
  }, event.guildId);
}

async function startEventManagement(message, idInput, guildId = message.guildId) {
  const id = String(idInput ?? '').trim().replaceAll('`', '').toUpperCase();
  if (!id) {
    await privateResponse(message, t('hostManageUsage', {}, message.guildId));
    return;
  }
  const event = guildId ? findGuildEvent(id, guildId) : allEvents().find((item) => item.id === id) ?? null;
  if (!event || !event.messageId) {
    await privateResponse(message, t('noEvent', {}, message.guildId ?? null));
    return;
  }
  const requesterIsAdmin = Boolean(message.guildId && event.creatorId !== message.author.id && await isServerAdmin(message));
  const permitted = canManageEvent(event, { userId: message.author.id, guildId: message.guildId ? guildId : null, isAdmin: requesterIsAdmin });
  if (!permitted) {
    await privateResponse(message, t('onlyCreatorManage', {}, event.guildId));
    return;
  }
  if (['cancelled', 'completed', 'skipped'].includes(event.status)) {
    await privateResponse(message, t('hostManageClosedEvent', {}, event.guildId));
    return;
  }

  setupSessions.delete(message.author.id);
  const content = renderHostManageMenu(event, message.author.id);
  try {
    await message.author.send(content);
    hostManageSessions.set(message.author.id, {
      eventId: event.id,
      guildId: event.guildId,
      step: 'menu',
      expiresAt: Date.now() + SETUP_SESSION_TTL_MS,
    });
    if (message.guildId) await tryDeleteCommand(message);
  } catch (error) {
    hostManageSessions.delete(message.author.id);
    logConsoleStyle('warn', '[Could not open host management DM]', error?.message ?? error);
    if (message.guildId) {
      await privateResponse(message, t('dmFailed', {}, event.guildId), { deleteCommand: false });
    } else {
      await safeReply(message, t('dmFailed', {}, event.guildId));
    }
  }
}

async function handleHostManageInput(message, rawInput) {
  const session = hostManageSessions.get(message.author.id);
  if (!session) return;
  if (session.expiresAt <= Date.now()) {
    hostManageSessions.delete(message.author.id);
    await message.author.send(t('hostManageExpired', {}, session.guildId)).catch(() => {});
    return;
  }
  const input = String(rawInput ?? '').trim();
  const lowered = input.toLowerCase();
  if (['cancel', 'отмена', 'стоп', 'выход'].includes(lowered)) {
    hostManageSessions.delete(message.author.id);
    await message.author.send(t('hostManageClosed', {}, session.guildId));
    return;
  }

  const event = allEvents().find((item) => item.id === session.eventId && item.guildId === session.guildId);
  if (!event) {
    hostManageSessions.delete(message.author.id);
    await message.author.send(t('noEvent', {}, session.guildId));
    return;
  }
  if (['cancelled', 'completed', 'skipped'].includes(event.status)) {
    hostManageSessions.delete(message.author.id);
    await message.author.send(t('hostManageClosedEvent', {}, event.guildId));
    return;
  }

  session.expiresAt = Date.now() + SETUP_SESSION_TTL_MS;
  if (session.step === 'menu') {
    if (['1', 'time', 'время', 'дата'].includes(lowered)) {
      session.step = 'time';
      await message.author.send(t('hostManageAskTime', {
        zone: event.timeZone,
        current: formatPersonalTime(event, message.author.id),
      }, event.guildId));
      return;
    }
    if (['2', 'description', 'описание', 'текст'].includes(lowered)) {
      session.step = 'description';
      await message.author.send(t('hostManageAskDescription', { current: event.description || '—' }, event.guildId));
      return;
    }
    if (['3', 'duration', 'длительность', 'продолжительность'].includes(lowered)) {
      session.step = 'duration';
      await message.author.send(t('hostManageAskDuration', { current: event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES }, event.guildId));
      return;
    }
    if (['4', 'finish', 'end', 'завершить', 'закончить'].includes(lowered)) {
      session.step = 'finishConfirm';
      await message.author.send(t('hostManageConfirmFinish', { title: event.title }, event.guildId));
      return;
    }
    if (['5', 'cancel event', 'cancel-event', 'отменить событие', 'отмена события'].includes(lowered)) {
      session.step = 'cancelConfirm';
      await message.author.send(t('hostManageConfirmCancel', { title: event.title }, event.guildId));
      return;
    }
    if (['6', 'close', 'закрыть', 'готово', 'done'].includes(lowered)) {
      hostManageSessions.delete(message.author.id);
      await message.author.send(t('hostManageClosed', {}, event.guildId));
      return;
    }
    await message.author.send(renderHostManageMenu(event, message.author.id));
    return;
  }

  if (session.step === 'time') {
    const normalizedTimeInput = normalizeLocalDateTimeInput(input);
    if (!normalizedTimeInput) {
      await message.author.send(t('hostManageInvalidTime', { zone: event.timeZone }, event.guildId));
      return;
    }
    const newLocal = DateTime.fromFormat(normalizedTimeInput, 'yyyy-MM-dd HH:mm', {
      zone: event.timeZone,
      setZone: true,
      locale: localeForGuild(event.guildId),
      numberingSystem: 'latn',
    });
    if (!newLocal.isValid || newLocal.toFormat('yyyy-MM-dd HH:mm') !== normalizedTimeInput) {
      await message.author.send(t('hostManageInvalidTime', { zone: event.timeZone }, event.guildId));
      return;
    }
    if (newLocal.toMillis() <= Date.now() + 60_000) {
      await message.author.send(t('timePast', {}, event.guildId));
      return;
    }
    const nextOccurrence = event.seriesId
      ? allEvents().filter((item) => item.seriesId === event.seriesId && item.seriesIndex > event.seriesIndex && item.status === 'scheduled')
        .sort((a, b) => DateTime.fromISO(a.startsAt, { zone: 'utc' }).toMillis() - DateTime.fromISO(b.startsAt, { zone: 'utc' }).toMillis())[0]
      : null;
    if (nextOccurrence) {
      const nextStart = DateTime.fromISO(nextOccurrence.startsAt, { zone: 'utc' });
      const proposedEnd = newLocal.toUTC().plus({ minutes: event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES });
      if (proposedEnd.toMillis() >= nextStart.toMillis()) {
        await message.author.send(t('hostManageSeriesOverlap', { when: timestampTag(nextOccurrence, 'F') }, event.guildId));
        return;
      }
    }
    event.startsAt = newLocal.toUTC().toISO({ suppressMilliseconds: true });
    // A delayed in-progress event is returned to scheduled so RSVPs and reminders are re-opened.
    event.status = 'scheduled';
    event.remindersSent = [];
    event.reminderDeliveries = {};
    // A reschedule starts a new lifecycle; discard any undelivered old start notice.
    event.noticeOutbox = (event.noticeOutbox ?? []).filter((notice) => notice.type !== 'event-start' || notice.status === 'completed');
    delete event.startNoticeQueuedAt;
    await saveEvents([event]);
    await refreshEventPost(event);
    await notifyInterestedMembers(event, `${t('noticeRescheduled', { title: event.title }, event.guildId)}\n📅 ${timestampTag(event, 'F')} · ${timestampTag(event, 'R')}`);
    session.step = 'menu';
    await message.author.send(`${t('hostManageSavedTime', {}, event.guildId)}\n\n${renderHostManageMenu(event, message.author.id)}`);
    return;
  }

  if (session.step === 'description') {
    const description = input === '-' ? '' : input;
    if (description.length > 700) {
      await message.author.send(t('descriptionInvalid', {}, event.guildId));
      return;
    }
    event.description = description;
    await saveEvents([event]);
    await refreshEventPost(event);
    await notifyInterestedMembers(event, `${t('noticeDescriptionChanged', { title: event.title }, event.guildId)}\n📝 ${description || t('noDescription', {}, event.guildId)}\n📅 ${timestampTag(event, 'F')} · ${timestampTag(event, 'R')}`);
    session.step = 'menu';
    await message.author.send(`${t('hostManageSavedDescription', {}, event.guildId)}\n\n${renderHostManageMenu(event, message.author.id)}`);
    return;
  }

  if (session.step === 'duration') {
    const duration = Number(input);
    if (!Number.isInteger(duration) || duration < 15 || duration > 1440) {
      await message.author.send(t('eventDurationInvalid', {}, event.guildId));
      return;
    }
    event.durationMinutes = duration;
    await saveEvents([event]);
    await refreshEventPost(event);
    await notifyInterestedMembers(event, `${t('noticeDurationChanged', { title: event.title, duration: formatDuration(duration, event.guildId) }, event.guildId)}\n📅 ${timestampTag(event, 'F')} · ${timestampTag(event, 'R')}`);
    session.step = 'menu';
    await message.author.send(`${t('hostManageSavedDuration', {}, event.guildId)}\n\n${renderHostManageMenu(event, message.author.id)}`);
    return;
  }

  if (session.step === 'finishConfirm' || session.step === 'cancelConfirm') {
    const yes = ['yes', 'да', 'y', 'подтверждаю'].includes(lowered);
    const no = ['no', 'нет', 'n'].includes(lowered);
    if (!yes && !no) {
      await message.author.send(t('hostManageConfirmAnswer', {}, event.guildId));
      return;
    }
    if (no) {
      session.step = 'menu';
      await message.author.send(renderHostManageMenu(event, message.author.id));
      return;
    }
    const shouldCancel = session.step === 'cancelConfirm';
    event.status = shouldCancel ? 'cancelled' : 'completed';
    if (!shouldCancel) event.endedEarlyAt = DateTime.utc().toISO({ suppressMilliseconds: true });
    await saveEvents([event]);
    await refreshEventPost(event);
    await notifyInterestedMembers(event, shouldCancel
      ? t('noticeCancelled', { title: event.title }, event.guildId)
      : t('noticeFinishedEarly', { title: event.title }, event.guildId));
    hostManageSessions.delete(message.author.id);
    await message.author.send(shouldCancel
      ? t('hostManageEventCancelled', { title: event.title }, event.guildId)
      : t('hostManageEventFinished', { title: event.title }, event.guildId));
    if (event.seriesId) await ensureUpcomingAnnouncement(event.seriesId);
  }
}

async function notifyInterestedMembers(event, content) {
  const interestedIds = [...new Set(event.attendees
    .filter((attendee) => ['yes', 'maybe'].includes(attendee.status) && attendee.userId !== event.creatorId)
    .map((attendee) => attendee.userId)
    .filter(Boolean))];
  if (interestedIds.length === 0) return;

  event.noticeOutbox ??= [];
  const notice = createNoticeJob(content, interestedIds, DateTime.utc().toISO({ suppressMilliseconds: true }));
  event.noticeOutbox.push(notice);
  // Keep every pending delivery and only a small completed diagnostic history.
  event.noticeOutbox = compactNoticeOutbox(event.noticeOutbox, 10);
  await saveEvents([event]);
  await deliverMemberNotice(event, notice);
}

const noticeJobsInFlight = new Set();

async function deliverMemberNotice(event, notice) {
  if (!notice || notice.status === 'completed') return;
  const jobKey = `${event.id}:${notice.id}`;
  if (noticeJobsInFlight.has(jobKey)) return;
  noticeJobsInFlight.add(jobKey);
  try {
    notice.attempts = (notice.attempts ?? 0) + 1;
    notice.lastAttemptAt = DateTime.utc().toISO({ suppressMilliseconds: true });
    const delivered = new Set(notice.deliveredIds ?? []);
    const pendingIds = (notice.recipientIds ?? []).filter((id) => id && !delivered.has(id));
    const dmFailures = [];

    for (const userId of pendingIds) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(notice.content);
        delivered.add(userId);
      } catch (error) {
        dmFailures.push(userId);
        logConsoleStyle('warn', `[Member update DM failed for event ${event.id}]`, error?.message ?? error);
      }
    }

    markNoticeDelivered(notice, [...delivered]);
    await saveEvents([event]);

    if (dmFailures.length) {
      try {
        const channel = await client.channels.fetch(event.channelId);
        if (!channel?.isTextBased?.()) throw new Error('Fallback destination is not a text channel.');
        const stillPending = dmFailures.filter((id) => !delivered.has(id));
        if (stillPending.length) {
          await channel.send({
            content: `${notice.content}\n${t('noticeDmFallback', {}, event.guildId)}\n${stillPending.map((id) => `<@${id}>`).join(' ')}`,
            allowedMentions: { parse: [], users: stillPending },
          });
          for (const userId of stillPending) delivered.add(userId);
        }
      } catch (error) {
        notice.lastError = String(error?.message ?? error).slice(0, 300);
        logConsoleStyle('error', `[Member notice channel fallback failed for event ${event.id}]`, error?.message ?? error);
      }
    }

    markNoticeDelivered(notice, [...delivered]);
    completeNoticeIfDelivered(notice, DateTime.utc().toISO({ suppressMilliseconds: true }));
    await saveEvents([event]);
  } catch (error) {
    logConsoleStyle('error', `[Member notice delivery failed for event ${event.id}]`, error?.message ?? error);
  } finally {
    noticeJobsInFlight.delete(jobKey);
  }
}

async function queueEventStartNotice(event) {
  if (!shouldQueueEventStartNotice(event)) return false;

  const createdAt = DateTime.utc().toISO({ suppressMilliseconds: true });
  const recipients = getEventStartNoticeRecipients(event);
  const notice = createNoticeJob(
    t('eventStartNotice', { title: event.title, when: timestampTag(event, 'F') }, event.guildId),
    recipients,
    createdAt,
  );
  notice.type = 'event-start';

  const previousOutbox = Array.isArray(event.noticeOutbox) ? [...event.noticeOutbox] : undefined;
  const previousQueuedAt = event.startNoticeQueuedAt;
  event.noticeOutbox = compactNoticeOutbox([...(event.noticeOutbox ?? []), notice], 10);
  event.startNoticeQueuedAt = createdAt;
  completeNoticeIfDelivered(notice, createdAt);

  try {
    await saveEvents([event]);
  } catch (error) {
    if (previousOutbox) event.noticeOutbox = previousOutbox;
    else delete event.noticeOutbox;
    if (previousQueuedAt === undefined) delete event.startNoticeQueuedAt;
    else event.startNoticeQueuedAt = previousQueuedAt;
    throw error;
  }

  log.info('Queued event-start notification', { eventId: event.id, recipientCount: recipients.length });
  return true;
}

async function retryPendingMemberNotices() {
  for (const event of allEvents()) {
    const pending = (event.noticeOutbox ?? []).filter((notice) => notice.status !== 'completed');
    for (const notice of pending) await deliverMemberNotice(event, notice);
  }
}

async function publishEventPost(event) {
  if (event.messageId || event.status !== 'scheduled') return Boolean(event.messageId);
  if (publishingEventIds.has(event.id)) return false;
  const startsAt = DateTime.fromISO(event.startsAt, { zone: 'utc' });
  if (!startsAt.isValid || startsAt.toMillis() <= Date.now() + 60_000) return false;

  publishingEventIds.add(event.id);
  try {
    const channel = await client.channels.fetch(event.channelId);
    if (!channel?.isGuild?.() || !channel?.isTextBased?.()) return false;
    const post = await channel.send({ content: renderEventCard(event), allowedMentions: { parse: [] } });
    event.messageId = post.id;
    event.publishedAt = DateTime.utc().toISO({ suppressMilliseconds: true });
    await saveEvents([event]);
    for (const emoji of RSVP_EMOJI.keys()) {
      try {
        await post.react(emoji);
      } catch (error) {
        logConsoleStyle('warn', `Could not add RSVP reaction ${emoji} to event ${event.id}. Check Add Reactions permission.`, error?.message ?? error);
      }
    }
    logConsoleStyle('info', `Published event ${event.id} to announcement channel ${event.channelId}.`);
    return true;
  } catch (error) {
    logConsoleStyle('error', `Could not publish event ${event.id}:`, error?.message ?? error);
    return false;
  } finally {
    publishingEventIds.delete(event.id);
  }
}

async function refreshEventPost(event) {
  if (!event.messageId || !event.channelId) return;
  try {
    const channel = await client.channels.fetch(event.channelId);
    if (!channel?.isTextBased?.()) return;
    const post = await channel.messages.fetch(event.messageId);
    await post.edit({ content: renderEventCard(event), allowedMentions: { parse: [] } });
  } catch (error) {
    logConsoleStyle('warn', `Could not refresh the post for event ${event.id}:`, error?.message ?? error);
  }
}

function renderEventCard(event) {
  const guildId = event.guildId;
  const yesCount = event.attendees.filter((attendee) => attendee.status === 'yes').length;
  const maybeCount = event.attendees.filter((attendee) => attendee.status === 'maybe').length;
  const capacity = event.maxAttendees === null
    ? `${yesCount} · ${t('cardNoLimit', {}, guildId)}`
    : `${yesCount}/${event.maxAttendees}`;

  const status = event.status === 'cancelled'
    ? ` · ⛔ ${t('cancelledTag', {}, guildId)}`
    : event.status === 'in_progress'
      ? ` · 🔴 ${t('inProgressTag', {}, guildId)}`
      : event.status === 'completed'
        ? ` · ☑️ ${t('completedTag', {}, guildId)}`
        : event.status === 'skipped'
          ? ` · ⚪ ${t('skippedTag', {}, guildId)}`
          : '';

  const lines = [
    `**🎉 ${escapeMarkdownInline(event.title)}**${status}`,
    formatAnnouncementTime(event),
    `👥 **${capacity}** · ⏳ ~${formatDuration(event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES, guildId)}${maybeCount ? ` · 🤔 ${t('cardMaybeCount', { count: maybeCount }, guildId)}` : ''}`,
  ];

  if (event.description) {
    const cleanDescription = String(event.description).replace(/\s+/g, ' ').trim();
    const shortDescription = [...cleanDescription].slice(0, 180).join('');
    lines.push(`📝 ${shortDescription}${[...cleanDescription].length > 180 ? '…' : ''}`);
  }

  if (event.status === 'scheduled' && !isEventStarted(event)) {
    lines.push('', t('cardRsvpHint', {}, guildId));
  } else if (event.status === 'in_progress') {
    lines.push('', t('eventStarted', {}, guildId));
  }

  return lines.join('\n');
}

function escapeMarkdownInline(value) {
  return String(value ?? '').replace(/[\\`*_{}[\]()#+.!|>~-]/g, '\\$&');
}

function renderEventDetails(event, userId) {
  const guildId = event.guildId;
  const yes = event.attendees.filter((attendee) => attendee.status === 'yes');
  const maybe = event.attendees.filter((attendee) => attendee.status === 'maybe');
  const state = event.status === 'cancelled' ? t('cancelledTag', {}, guildId)
    : event.status === 'in_progress' ? t('inProgressTag', {}, guildId)
      : event.status === 'completed' ? t('completedTag', {}, guildId) : null;
  const guild = client.guilds.get(guildId);
  const lines = [
    `🎉 **${event.title}**${state ? ` · ${state}` : ''}`,
    `🏠 **${t('dmCommunityLabel', {}, guildId)}:** ${guild?.name ?? guildId}`,
    `📣 **${t('dmChannelLabel', {}, guildId)}:** <#${event.channelId}>`,
    `🆔 **ID:** \`${event.id}\``,
    formatPersonalTime(event, userId),
    `👤 ${t('host', {}, guildId)}: ${event.creatorName}`,
    `👥 ${t('spots', {}, guildId)}: ${event.maxAttendees === null ? `${yes.length} · ${langForGuild(guildId) === 'ru' ? 'без лимита' : 'no limit'}` : `${yes.length}/${event.maxAttendees}`}`,
    `✅ ${t('attending', {}, guildId)} (${yes.length}): ${yes.length ? yes.map((a) => a.username).slice(0, 30).join(', ') : t('noConfirmed', {}, guildId)}`,
    `🤔 ${t('maybe', {}, guildId)} (${maybe.length}): ${maybe.length ? maybe.map((a) => a.username).slice(0, 20).join(', ') : '—'}`,
  ];
  if (event.description) lines.push(`📝 ${t('details', {}, guildId)}: ${event.description}`);
  if (event.status === 'scheduled' && !isEventStarted(event)) {
    lines.push('', langForGuild(guildId) === 'ru'
      ? `RSVP: \`!событие rsvp ${event.id} да|возможно|нет\``
      : `RSVP: \`!event rsvp ${event.id} yes|maybe|no\``);
  }
  return lines.join('\n');
}

function findGuildEvent(idInput, guildId) {
  return findGuildScopedEvent(allEvents(), idInput, guildId);
}

function newEventId() {
  let id;
  do {
    id = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  } while (allEvents().some((event) => event.id === id));
  return id;
}

function isEventStarted(event) {
  return DateTime.fromISO(event.startsAt, { zone: 'utc' }).toMillis() <= DateTime.utc().toMillis();
}

async function runSchedulerSafely() {
  if (schedulerBusy || !gatewayReady) return;
  schedulerBusy = true;
  try {
    // Pause scheduling if the gateway socket is not actually open. Pending
    // reminder jobs remain persisted and can be retried after the session resumes.
    const gatewayHealthy = await isGatewayConnectionHealthy(client, gatewayReady);
    if (!gatewayHealthy) {
      gatewayReady = false;
      log.warn('Gateway is not ready; scheduler pass skipped');
      return;
    }
    if (!await isStoreHealthy()) {
      log.warn('Store is not healthy; scheduler pass skipped');
      return;
    }
    await advanceEvents();
    await checkReminders();
    await retryPendingMemberNotices();
    await retryPendingHostOccurrenceNotices();
  } catch (error) {
    logConsoleStyle('error', '[Scheduler]', error);
  } finally {
    schedulerBusy = false;
  }
}

async function advanceEvents() {
  const now = DateTime.utc();
  const changed = [];
  for (const event of allEvents()) {
    const startsAt = DateTime.fromISO(event.startsAt, { zone: 'utc' });
    if (!startsAt.isValid) continue;
    const endAt = startsAt.plus({ minutes: event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES });

    if (event.status === 'scheduled' && event.messageId && startsAt <= now) {
      event.status = endAt <= now ? 'completed' : 'in_progress';
      changed.push(event);
    } else if (event.status === 'in_progress' && endAt <= now) {
      event.status = 'completed';
      changed.push(event);
    }
  }
  if (changed.length) {
    await saveEvents(changed);
    for (const event of changed) await refreshEventPost(event);
  }

  // Also catches a restart between persisting the status transition and queueing its notice.
  for (const event of allEvents()) {
    if (shouldQueueEventStartNotice(event)) await queueEventStartNotice(event);
  }

  const seriesIds = new Set(allEvents().map((event) => event.seriesId).filter(Boolean));
  for (const seriesId of seriesIds) await ensureUpcomingAnnouncement(seriesId);
}

async function ensureUpcomingAnnouncement(seriesId) {
  const group = allEvents().filter((event) => event.seriesId === seriesId).sort((a, b) => a.seriesIndex - b.seriesIndex);
  if (!group.length) return;
  const nowMillis = DateTime.utc().toMillis();

  // A series has one actionable occurrence at a time. Keep its card active
  // through the entire duration, including after the start time.
  const alreadyPublishedActive = hasActivePublishedOccurrence(group);
  if (alreadyPublishedActive) return;

  let markedSkipped = false;
  for (const event of group) {
    if (event.status === 'scheduled' && !event.messageId
      && DateTime.fromISO(event.startsAt, { zone: 'utc' }).toMillis() <= nowMillis + 60_000) {
      event.status = 'skipped';
      markedSkipped = true;
    }
  }
  if (markedSkipped) await saveEvents(group.filter((event) => event.status === 'skipped'));

  const next = group
    .filter((event) => event.status === 'scheduled' && !event.messageId
      && DateTime.fromISO(event.startsAt, { zone: 'utc' }).toMillis() > Date.now() + 60_000)
    .sort((a, b) => DateTime.fromISO(a.startsAt).toMillis() - DateTime.fromISO(b.startsAt).toMillis())[0];
  if (next) {
    // Persist the host notification intent before publishing; the scheduler can retry
    // after a restart if posting succeeds but the DM/fallback fails.
    if (next.seriesIndex > 1) {
      next.hostPublishNoticePending = true;
      await saveEvents([next]);
    }
    const published = await publishEventPost(next);
    if (published && next.hostPublishNoticePending) await notifyHostOccurrencePublished(next);
  }
}

async function checkReminders() {
  const now = DateTime.utc();
  for (const event of allEvents()) {
    if (!['scheduled', 'in_progress'].includes(event.status) || !event.channelId || !event.messageId) continue;
    const startsAt = DateTime.fromISO(event.startsAt, { zone: 'utc' });
    if (!startsAt.isValid) continue;

    event.remindersSent ??= [];
    event.reminderDeliveries ??= {};
    const attendees = event.attendees.filter((attendee) => attendee.status === 'yes');
    // The host receives reminders even if they did not add a separate RSVP.
    const recipients = [...attendees];
    if (event.creatorId && !recipients.some((attendee) => attendee.userId === event.creatorId)) {
      recipients.push({ userId: event.creatorId, username: event.creatorName ?? 'Host', status: 'yes' });
    }
    let changed = false;

    for (const reminder of REMINDERS) {
      const key = reminder.id;
      if (event.remindersSent.includes(key)) continue;
      const reminderWindow = getReminderWindow(now.toMillis(), startsAt.toMillis(), reminder.minutes, REMINDER_GRACE_MINUTES);
      if (reminderWindow === 'not-due') continue;
      if (reminderWindow === 'expired') {
        event.remindersSent.push(key);
        changed = true;
        continue;
      }
      if (recipients.length === 0) continue;

      const delivered = new Set(event.reminderDeliveries[key] ?? []);
      const pending = recipients.filter((attendee) => attendee.userId && !delivered.has(attendee.userId));
      if (pending.length === 0) {
        event.remindersSent.push(key);
        changed = true;
        continue;
      }

      const content = `${t('reminderTitle', {
        title: event.title,
        relative: t(reminder.key, {}, event.guildId),
        when: timestampTag(event, 'F'),
      }, event.guildId)}\n${timestampTag(event, 'R')}`;
      const dmFailures = [];
      for (const attendee of pending) {
        try {
          const user = await client.users.fetch(attendee.userId);
          await user.send(content);
          delivered.add(attendee.userId);
        } catch (error) {
          dmFailures.push(attendee);
          logConsoleStyle('warn', `Could not DM reminder ${key} for event ${event.id}:`, error?.message ?? error);
        }
      }

      let fallbackDelivered = false;
      if (dmFailures.length) {
        try {
          const channel = await client.channels.fetch(event.channelId);
          if (channel?.isTextBased?.()) {
            const failedIds = [...new Set(dmFailures.map((attendee) => attendee.userId))];
            await channel.send({
              content: `${content}\n${t('reminderFallback', {}, event.guildId)}\n${failedIds.map((id) => `<@${id}>`).join(' ')}`,
              allowedMentions: { parse: [], users: failedIds },
            });
            for (const id of failedIds) delivered.add(id);
            fallbackDelivered = true;
          }
        } catch (error) {
          logConsoleStyle('error', `Could not send channel fallback for ${key} reminder on event ${event.id}:`, error?.message ?? error);
        }
      }

      event.reminderDeliveries[key] = [...delivered];
      const recipientIds = [...new Set(recipients.map((attendee) => attendee.userId).filter(Boolean))];
      if (recipientIds.every((id) => delivered.has(id))) event.remindersSent.push(key);
      changed = true;
      if (dmFailures.length && !fallbackDelivered) {
        logConsoleStyle('warn', `Some recipients for ${key} reminder on event ${event.id} remain undelivered; will retry on the next scheduler pass.`);
      }
    }
    if (changed) await saveEvents([event]);
  }
}
