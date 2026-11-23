const EVENT_COLORS = Object.freeze({
  scheduled: 0x5865f2,
  in_progress: 0xd97706,
  cancelled: 0xdc2626,
  completed: 0x16a34a,
  skipped: 0x64748b,
});

function text(value, fallback = '—', maxLength = 1024) {
  const normalized = String(value ?? '').trim() || fallback;
  return [...normalized].slice(0, maxLength).join('');
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
  const joined = names.slice(0, 30).join(', ');
  return text(joined, '—', 1000);
}

function statusColor(status) {
  return EVENT_COLORS[status] ?? EVENT_COLORS.scheduled;
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
  const fields = [
    { name: text(whenLabel, 'When', 256), value: text(when ?? event?.startsAt), inline: false },
    { name: text(attendeesLabel, 'Attending', 256), value: attendanceSummary(event, attendees, noLimitLabel, maybeLabel), inline: true },
    { name: text(durationLabel, 'Duration', 256), value: text(duration, '—'), inline: true },
  ];

  return {
    title: text(`🎉 ${event?.title ?? 'Untitled event'}${statusSuffix}`, '🎉 Event', 256),
    ...(String(event?.description ?? '').trim()
      ? { description: text(event.description, '', 4096) }
      : {}),
    color: statusColor(event?.status),
    fields,
    footer: {
      text: text(footer || `Event ID: ${event?.id ?? 'unknown'}`, 'Event', 2048),
    },
  };
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
  const fields = [
    { name: text(labels.community, 'Community', 256), value: text(communityName), inline: true },
    { name: text(labels.announcements, 'Announcements', 256), value: text(channelMention), inline: true },
    { name: text(labels.when, 'When', 256), value: text(when ?? event?.startsAt), inline: false },
    { name: text(labels.host, 'Host', 256), value: text(event?.creatorName, 'Unknown'), inline: true },
    { name: text(labels.attendees, 'Attending', 256), value: attendanceSummary(event, attendees, noLimitLabel, maybeLabel), inline: true },
    { name: text(labels.duration, 'Duration', 256), value: text(duration), inline: true },
    { name: text(labels.attendingNames, 'Attending members', 256), value: attendeeNames(attendees, 'yes'), inline: false },
    { name: text(labels.maybeNames, 'Maybe members', 256), value: attendeeNames(attendees, 'maybe'), inline: false },
  ];
  if (labels.status && labels.statusValue) {
    fields.splice(3, 0, {
      name: text(labels.status, 'Status', 256),
      value: text(labels.statusValue),
      inline: true,
    });
  }

  return {
    title: text(`🎉 ${event?.title ?? 'Untitled event'}`, '🎉 Event', 256),
    ...(String(event?.description ?? '').trim()
      ? { description: text(event.description, '', 4096) }
      : {}),
    color: statusColor(event?.status),
    fields,
    footer: {
      text: text(footer || `Event ID: ${event?.id ?? 'unknown'}`, 'Event', 2048),
    },
  };
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
  const fields = safeEvents.map((event) => {
    const attendees = attendeesOf(event);
    let when = event?.startsAt;
    try {
      if (typeof formatWhen === 'function') when = formatWhen(event);
    } catch {
      // Use the stored ISO timestamp when personal-time formatting is unavailable.
    }
    return {
      name: text(`${event?.title ?? 'Untitled event'} · ${event?.id ?? 'unknown'}`, 'Event', 256),
      value: text(`${when ?? '—'}\n${attendanceSummary(event, attendees, noLimitLabel, maybeLabel)}`, '—', 1024),
      inline: false,
    };
  });

  return {
    title: text(labels.title, 'Upcoming events', 256),
    description: [
      `**${text(labels.community, 'Community', 80)}:** ${text(communityName)}`,
      `**${text(labels.announcements, 'Announcements', 80)}:** ${text(channelMention)}`,
    ].join('\n'),
    color: EVENT_COLORS.scheduled,
    fields,
    footer: {
      text: text(footer, 'Open event details for attendee information.', 2048),
    },
  };
}

export function getEventEmbedColor(status) {
  return statusColor(status);
}
