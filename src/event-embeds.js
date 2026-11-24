const EVENT_COLORS = Object.freeze({
  scheduled: 0x5865f2,
  in_progress: 0xd97706,
  cancelled: 0xdc2626,
  completed: 0x16a34a,
  skipped: 0x64748b,
});

function text(value, fallback = '—', maxLength = 1024) {
  const normalized = String(value ?? '').trim() || fallback;
  let output = '';
  let units = 0;
  for (const character of normalized) {
    if (units + character.length > maxLength) break;
    output += character;
    units += character.length;
  }
  return output;
}

function attendeesOf(event) {
  return Array.isArray(event?.attendees)
    ? event.attendees.filter((attendee) => attendee && typeof attendee === 'object' && !Array.isArray(attendee))
    : [];
}

function attendanceSummary(event, attendees, noLimitLabel, maybeLabel) {
  const yesCount = attendees.filter((attendee) => attendee.status === 'yes').length;
  const maybeCount = attendees.filter((attendee) => attendee.status === 'maybe').length;
  const max = Number(event?.maxAttendees);
  const capacity = Number.isInteger(max) && max > 0 ? `${yesCount}/${max}` : `${yesCount} · ${noLimitLabel}`;
  return maybeCount ? `${capacity} · ${maybeLabel}: ${maybeCount}` : capacity;
}

function attendeeNames(attendees, status) {
  const names = attendees.filter((attendee) => attendee.status === status)
    .map((attendee) => text(attendee.username ?? attendee.name, 'Unknown', 80));
  if (!names.length) return '—';
  return text(names.slice(0, 30).join(', '), '—', 1000);
}

function statusColor(status) {
  return EVENT_COLORS[status] ?? EVENT_COLORS.scheduled;
}

/**
 * Fluxer enforces a 6,000-character aggregate embed budget in addition to
 * per-property limits. Keep a predictable budget for the header and footer,
 * then clip field payloads rather than failing the entire send.
 */
function fitEmbed(payload) {
  const title = text(payload.title, 'Event', 256);
  const description = text(payload.description, '', 2048);
  const footerText = text(payload.footer?.text, 'Event', 512);
  let remaining = 6000 - title.length - description.length - footerText.length;
  const fields = [];

  for (const field of (Array.isArray(payload.fields) ? payload.fields : []).slice(0, 25)) {
    if (remaining < 2) break;
    const name = text(field?.name, 'Details', Math.min(256, remaining - 1));
    remaining -= name.length;
    if (remaining < 1) break;
    const value = text(field?.value, '—', Math.min(1024, remaining));
    remaining -= value.length;
    fields.push({ name, value, inline: Boolean(field?.inline) });
  }

  return {
    ...payload,
    title,
    ...(description ? { description } : {}),
    fields,
    footer: { text: footerText },
  };
}

export function buildEventAnnouncementEmbed(event, {
  when,
  duration,
  noLimitLabel = 'no limit',
  maybeLabel = 'Maybe',
  whenLabel = 'When',
  attendeesLabel = 'Attending',
  durationLabel = 'Duration',
  statusLabel = '',
  footer = '',
} = {}) {
  const attendees = attendeesOf(event);
  const statusSuffix = event?.status && event.status !== 'scheduled' && statusLabel ? ` · ${statusLabel}` : '';
  const description = String(event?.description ?? '').trim();
  const fields = [
    { name: text(whenLabel, '📅 When', 256), value: text(when ?? event?.startsAt), inline: false },
    { name: text(attendeesLabel, '👥 Attending', 256), value: attendanceSummary(event, attendees, noLimitLabel, maybeLabel), inline: true },
    { name: text(durationLabel, '⏱️ Duration', 256), value: text(duration, '—'), inline: true },
  ];

  return fitEmbed({
    title: text(`🎉 ${event?.title ?? 'Untitled event'}${statusSuffix}`, '🎉 Event', 256),
    ...(description ? { description } : {}),
    color: statusColor(event?.status),
    fields,
    footer: {
      text: text(footer || `EVENT · ${event?.id ?? 'unknown'}`, 'Event', 512),
    },
  });
}

export function buildEventDetailsEmbed(event, {
  communityName,
  channelMention,
  when,
  duration,
  noLimitLabel = 'no limit',
  maybeLabel = 'Maybe',
  labels = {},
  footer = '',
} = {}) {
  const attendees = attendeesOf(event);
  const metadata = [
    `🏠 **${text(labels.community, 'Community', 80)}:** ${text(communityName)}`,
    `📣 **${text(labels.announcements, 'Announcements', 80)}:** ${text(channelMention)}`,
  ].join('  ·  ');
  const description = [
    String(event?.description ?? '').trim(),
    metadata,
  ].filter(Boolean).join('\n\n');
  const fields = [
    { name: text(labels.when, '📅 When', 256), value: text(when ?? event?.startsAt), inline: false },
    { name: text(labels.host, '👤 Host', 256), value: text(event?.creatorName, 'Unknown'), inline: true },
    { name: text(labels.attendees, '👥 Attending', 256), value: attendanceSummary(event, attendees, noLimitLabel, maybeLabel), inline: true },
    { name: text(labels.duration, '⏱️ Duration', 256), value: text(duration), inline: true },
  ];
  if (labels.status && labels.statusValue) {
    fields.splice(1, 0, {
      name: text(labels.status, '◈ Status', 256),
      value: text(labels.statusValue),
      inline: true,
    });
  }
  fields.push(
    { name: text(labels.attendingNames, '✅ Attending members', 256), value: attendeeNames(attendees, 'yes'), inline: true },
    { name: text(labels.maybeNames, '🤔 Maybe members', 256), value: attendeeNames(attendees, 'maybe'), inline: true },
  );

  return fitEmbed({
    title: text(`🎉 ${event?.title ?? 'Untitled event'}`, '🎉 Event', 256),
    ...(description ? { description } : {}),
    color: statusColor(event?.status),
    fields,
    footer: {
      text: text(footer || `EVENT · ${event?.id ?? 'unknown'}`, 'Event', 512),
    },
  });
}

export function buildUpcomingEventsEmbed(events, {
  communityName,
  channelMention,
  formatWhen,
  noLimitLabel = 'no limit',
  maybeLabel = 'Maybe',
  labels = {},
  footer = '',
} = {}) {
  const safeEvents = Array.isArray(events) ? events.slice(0, 20) : [];
  const fields = safeEvents.map((event, index) => {
    const attendees = attendeesOf(event);
    let when = event?.startsAt;
    try {
      if (typeof formatWhen === 'function') when = formatWhen(event);
    } catch {
      // Keep the stored ISO timestamp if personal-time formatting is unavailable.
    }
    const yesCount = attendees.filter((attendee) => attendee.status === 'yes').length;
    const maybeCount = attendees.filter((attendee) => attendee.status === 'maybe').length;
    const max = Number(event?.maxAttendees);
    const capacity = Number.isInteger(max) && max > 0 ? `${yesCount}/${max}` : `${yesCount} · ${noLimitLabel}`;
    const attendance = maybeCount ? `👥 ${capacity}  ·  🤔 ${maybeLabel}: ${maybeCount}` : `👥 ${capacity}`;
    return {
      name: `${String(index + 1).padStart(2, '0')}  ·  🎉 ${text(event?.title, 'Untitled event', 190)}  ·  ${text(event?.id, 'unknown', 64)}`,
      value: `📅 ${text(when)}     ${attendance}`,
      inline: false,
    };
  });

  return fitEmbed({
    title: `🗓️ ${text(labels.title, 'Upcoming events', 248)}`,
    description: [
      `🏠 **${text(labels.community, 'Community', 80)}:** ${text(communityName)}`,
      `📣 **${text(labels.announcements, 'Announcements', 80)}:** ${text(channelMention)}`,
    ].join('  ·  '),
    color: EVENT_COLORS.scheduled,
    fields,
    footer: {
      text: text(footer, 'Open an event for attendee details.', 512),
    },
  });
}

export function getEventEmbedColor(status) {
  return statusColor(status);
}
