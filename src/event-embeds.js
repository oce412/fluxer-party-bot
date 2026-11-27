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

function attendanceCounts(attendees) {
  return {
    yes: attendees.filter((attendee) => attendee.status === 'yes').length,
    maybe: attendees.filter((attendee) => attendee.status === 'maybe').length,
  };
}

function attendanceCapacity(event, yesCount, noLimitLabel) {
  const max = Number(event?.maxAttendees);
  return Number.isInteger(max) && max > 0
    ? `${yesCount}/${max}`
    : `${yesCount} · ${noLimitLabel}`;
}

function announcementAttendance(event, attendees, noLimitLabel, maybeLabel) {
  const counts = attendanceCounts(attendees);
  const capacity = attendanceCapacity(event, counts.yes, noLimitLabel);
  return counts.maybe
    ? `**${capacity}**\n🤔 ${text(maybeLabel, 'Maybe', 80)}: ${counts.maybe}`
    : `**${capacity}**`;
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

function statusAuthor(event, hostLabel) {
  const creatorName = String(event?.creatorName ?? '').trim();
  return creatorName
    ? { name: `${text(hostLabel, 'Host', 80)} · ${text(creatorName, 'Unknown', 160)}` }
    : undefined;
}

/**
 * Fluxer enforces a 6,000-character aggregate embed budget as well as
 * per-property limits. Clip each section before adding it so the complete
 * payload remains valid even when event descriptions or attendee lists are long.
 */
function fitEmbed(payload) {
  const title = text(payload.title, 'Event', 256);
  const description = text(payload.description, '', 2048);
  const footerText = text(payload.footer?.text, 'Event', 512);
  const authorName = payload.author?.name ? text(payload.author.name, '', 256) : '';
  const author = authorName ? { name: authorName } : undefined;
  let remaining = 6000 - title.length - description.length - footerText.length - authorName.length;
  const fields = [];

  for (const field of (Array.isArray(payload.fields) ? payload.fields : []).slice(0, 25)) {
    if (remaining < 3) break;
    const name = text(field?.name, 'Details', Math.min(256, remaining - 2));
    if (!name) break;
    remaining -= name.length;
    const value = text(field?.value, '—', Math.min(1024, remaining - 1));
    if (!value) break;
    remaining -= value.length;
    fields.push({ name, value, inline: Boolean(field?.inline) });
  }

  return {
    ...payload,
    title,
    ...(description ? { description } : {}),
    ...(author ? { author } : {}),
    fields,
    footer: { text: footerText },
  };
}

function scheduleLine(when, whenLabel) {
  const label = text(whenLabel, 'Starts', 80).replace(/^📅\s*/, '');
  const formattedWhen = text(when).replace(/^📅\s*/, '');
  return `📅 **${label}** · ${formattedWhen}`;
}

function compactEventDescription(event, when, whenLabel) {
  const parts = [];
  const description = String(event?.description ?? '').trim();
  if (description) parts.push(description);
  if (when) parts.push(scheduleLine(when, whenLabel));
  return parts.join('\n\n');
}

export function buildEventAnnouncementEmbed(event, {
  when,
  duration,
  noLimitLabel = 'no limit',
  maybeLabel = 'Maybe',
  whenLabel = 'Starts',
  attendeesLabel = '👥 Attending',
  durationLabel = '⏳ Duration',
  statusLabel = '',
  hostLabel = 'Host',
  footer = '',
} = {}) {
  const attendees = attendeesOf(event);
  const counts = attendanceCounts(attendees);
  const statusSuffix = event?.status && event.status !== 'scheduled' && statusLabel ? ` · ${statusLabel}` : '';

  // Keep the date in the reading flow instead of giving it a separate,
  // full-width field. Two compact fields below carry the scan-friendly stats.
  const description = compactEventDescription(event, when ?? event?.startsAt, whenLabel);
  const fields = [
    {
      name: text(attendeesLabel, '👥 Attending', 256),
      value: announcementAttendance(event, attendees, noLimitLabel, maybeLabel),
      inline: true,
    },
    {
      name: text(durationLabel, '⏳ Duration', 256),
      value: `**${text(duration, '—', 100)}**`,
      inline: true,
    },
  ];

  return fitEmbed({
    author: statusAuthor(event, hostLabel),
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
  const counts = attendanceCounts(attendees);
  const capacity = attendanceCapacity(event, counts.yes, noLimitLabel);
  const metadata = [
    `🏠 **${text(labels.community, 'Community', 80)}:** ${text(communityName)}`,
    `📣 **${text(labels.announcements, 'Announcements', 80)}:** ${text(channelMention)}`,
  ].join('  ·  ');
  const description = [
    String(event?.description ?? '').trim(),
    when ? scheduleLine(when, labels.when ?? 'Starts') : '',
    metadata,
  ].filter(Boolean).join('\n\n');

  const fields = [];
  if (labels.status && labels.statusValue) {
    fields.push({
      name: text(labels.status, 'Status', 256),
      value: text(labels.statusValue),
      inline: true,
    });
  }
  fields.push(
    {
      name: text(labels.attendees, '👥 Attending', 256),
      value: counts.maybe
        ? `**${capacity}**\n🤔 ${text(maybeLabel, 'Maybe', 80)}: ${counts.maybe}`
        : `**${capacity}**`,
      inline: true,
    },
    {
      name: text(labels.duration, '⏳ Duration', 256),
      value: `**${text(duration, '—', 100)}**`,
      inline: true,
    },
    {
      name: text(labels.attendingNames, '✅ Attending members', 256),
      value: attendeeNames(attendees, 'yes'),
      inline: true,
    },
    {
      name: text(labels.maybeNames, '🤔 Maybe members', 256),
      value: attendeeNames(attendees, 'maybe'),
      inline: true,
    },
  );

  return fitEmbed({
    author: statusAuthor(event, labels.host ?? 'Host'),
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
    const counts = attendanceCounts(attendees);
    let when = event?.startsAt;
    try {
      if (typeof formatWhen === 'function') when = formatWhen(event);
    } catch {
      // Keep the stored ISO timestamp if personal-time formatting is unavailable.
    }
    const capacity = attendanceCapacity(event, counts.yes, noLimitLabel);
    const attendance = counts.maybe
      ? `👥 ${capacity} · 🤔 ${text(maybeLabel, 'Maybe', 80)}: ${counts.maybe}`
      : `👥 ${capacity}`;
    const eventId = text(event?.id, 'unknown', 64);

    return {
      name: `${String(index + 1).padStart(2, '0')} · ${text(event?.title, 'Untitled event', 170)}`,
      value: `📅 ${text(when)}\n${attendance} · ID: \`${eventId}\``,
      inline: false,
    };
  });

  return fitEmbed({
    ...(communityName ? { author: { name: text(communityName, 'Community', 256) } } : {}),
    title: `🗓️ ${text(labels.title, 'Upcoming events', 248)}`,
    description: channelMention
      ? `📣 **${text(labels.announcements, 'Announcements', 80)}:** ${text(channelMention)}`
      : '',
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
