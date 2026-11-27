import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventAnnouncementEmbed,
  buildEventDetailsEmbed,
  buildUpcomingEventsEmbed,
  getEventEmbedColor,
} from '../src/event-embeds.js';

const event = {
  id: 'A1B2C3D4',
  title: 'Board Game Night',
  description: 'Bring your favourite game.',
  startsAt: '2026-12-05T17:00:00.000Z',
  status: 'scheduled',
  maxAttendees: 12,
  durationMinutes: 120,
  creatorName: 'Alex Example',
  attendees: [
    { username: 'Alice', status: 'yes' },
    { username: 'Bob', status: 'yes' },
    { username: 'Charlie', status: 'maybe' },
    null,
    'invalid',
  ],
};

test('builds a compact announcement with host, start time and scan-friendly RSVP stats', () => {
  const embed = buildEventAnnouncementEmbed(event, {
    when: '📅 Dec 5, 2026, 18:00 · in 8 days',
    duration: '2h',
    noLimitLabel: 'no limit',
    maybeLabel: 'Maybe',
    whenLabel: '📅 Starts',
    attendeesLabel: '👥 Attending',
    durationLabel: '⏳ Duration',
    hostLabel: 'Host',
    footer: 'Event A1B2C3D4 · React below to RSVP',
  });

  assert.equal(embed.author.name, 'Host · Alex Example');
  assert.equal(embed.title, '🎉 Board Game Night');
  assert.match(embed.description, /Bring your favourite game\./);
  assert.match(embed.description, /📅 \*\*Starts\*\* · Dec 5, 2026, 18:00 · in 8 days/);
  assert.equal(embed.color, getEventEmbedColor('scheduled'));
  assert.equal(embed.fields.length, 2);
  assert.equal(embed.fields[0].name, '👥 Attending');
  assert.equal(embed.fields[0].value, '**2/12**\n🤔 Maybe: 1');
  assert.equal(embed.fields[0].inline, true);
  assert.equal(embed.fields[1].name, '⏳ Duration');
  assert.equal(embed.fields[1].value, '**2h**');
  assert.equal(embed.footer.text, 'Event A1B2C3D4 · React below to RSVP');
});

test('announcement embeds retain the schedule line and status when the event description is empty', () => {
  const embed = buildEventAnnouncementEmbed({
    ...event,
    status: 'cancelled',
    description: ' ',
    attendees: [],
    maxAttendees: null,
  }, {
    when: 'Cancelled',
    duration: '2h',
    statusLabel: 'Cancelled',
    whenLabel: 'Starts',
    footer: 'Event A1B2C3D4',
  });

  assert.match(embed.title, /Cancelled/);
  assert.equal(embed.color, getEventEmbedColor('cancelled'));
  assert.equal(embed.description, '📅 **Starts** · Cancelled');
  assert.equal(embed.fields[0].value, '**0 · no limit**');
});

test('builds a DM details embed with compact metadata and grouped attendee names', () => {
  const embed = buildEventDetailsEmbed(event, {
    communityName: 'Test Community',
    channelMention: '<#123>',
    when: 'Dec 5, 2026, 18:00',
    duration: '2h',
    labels: {
      community: 'Community',
      announcements: 'Announcements',
      when: 'Starts',
      host: 'Host',
      attendees: 'Places',
      duration: 'Duration',
      attendingNames: 'Confirmed attendees',
      maybeNames: 'Maybe attendees',
    },
    footer: 'Event ID: A1B2C3D4',
  });

  assert.equal(embed.author.name, 'Host · Alex Example');
  assert.match(embed.description, /Test Community/);
  assert.match(embed.description, /<#123>/);
  assert.match(embed.description, /Dec 5, 2026, 18:00/);
  assert.equal(embed.fields.find((field) => field.name === 'Confirmed attendees').value, 'Alice, Bob');
  assert.equal(embed.fields.find((field) => field.name === 'Maybe attendees').value, 'Charlie');
  assert.equal(embed.fields.find((field) => field.name === 'Places').value, '**2 · no limit**\n🤔 Maybe: 1');
  assert.equal(embed.color, getEventEmbedColor('scheduled'));
});

test('builds an upcoming list with a quiet community header and compact event rows', () => {
  const embed = buildUpcomingEventsEmbed([event, { ...event, id: 'E5E5E5E5', title: 'Movie Night' }], {
    communityName: 'Test Community',
    channelMention: '<#123>',
    formatWhen: (item) => item.title,
    labels: {
      title: 'Upcoming events',
      announcements: 'Announcements',
    },
    footer: 'Use !event info ID for full details.',
  });

  assert.equal(embed.author.name, 'Test Community');
  assert.ok(embed.title.includes('Upcoming events'));
  assert.match(embed.description, /<#123>/);
  assert.equal(embed.fields.length, 2);
  assert.equal(embed.fields[0].name, '01 · Board Game Night');
  assert.match(embed.fields[0].value, /📅 Board Game Night/);
  assert.match(embed.fields[0].value, /👥 2\/12 · 🤔 Maybe: 1 · ID: `A1B2C3D4`/);
});

test('embed builders safely truncate user-controlled text and handle missing event data', () => {
  const embed = buildEventAnnouncementEmbed({
    title: 'x'.repeat(400),
    description: 'y'.repeat(5000),
    attendees: 'broken',
    status: 'new-status',
  }, {
    when: 'z'.repeat(2000),
    duration: '1h',
  });

  assert.equal(embed.title.length, 256);
  assert.equal(embed.description.length, 2048);
  assert.ok(embed.fields.every((field) => field.name.length <= 256 && field.value.length <= 1024));
  assert.equal(embed.color, getEventEmbedColor('scheduled'));
});

test('event info and list embeds respect Fluxer field limits', () => {
  const many = Array.from({ length: 25 }, (_, index) => ({ ...event, id: String(index), title: 'Event ' + index }));
  const embed = buildUpcomingEventsEmbed(many, { formatWhen: (item) => item.startsAt });
  assert.equal(embed.fields.length, 20);
  assert.ok(embed.fields.every((field) => field.name.length <= 256 && field.value.length <= 1024));
});

test('all generated embed payloads stay within the aggregate Fluxer text budget', () => {
  const longEvent = {
    ...event,
    title: 'A very long event title '.repeat(30),
    description: 'A detailed event description. '.repeat(200),
    attendees: Array.from({ length: 80 }, (_, index) => ({
      username: 'Attendee ' + index + ' '.repeat(20),
      status: index % 3 === 0 ? 'maybe' : 'yes',
    })),
  };
  const embeds = [
    buildEventAnnouncementEmbed(longEvent, {
      when: 'A long formatted date '.repeat(80),
      duration: 'A duration label',
      footer: 'ID · '.repeat(100),
    }),
    buildEventDetailsEmbed(longEvent, {
      communityName: 'Community '.repeat(80),
      channelMention: '<#123456789>',
      when: 'A long formatted date '.repeat(80),
      duration: 'A duration label',
      labels: {
        community: 'Community',
        announcements: 'Announcements',
        when: 'When',
        host: 'Host',
        attendees: 'Attending',
        duration: 'Duration',
        attendingNames: 'Attending members',
        maybeNames: 'Maybe members',
        status: 'Status',
        statusValue: 'Scheduled',
      },
      footer: 'ID · '.repeat(100),
    }),
    buildUpcomingEventsEmbed(
      Array.from({ length: 20 }, (_, index) => ({
        ...longEvent,
        id: 'EVENT-' + index,
      })),
      {
        communityName: 'Community '.repeat(80),
        channelMention: '<#123456789>',
        formatWhen: () => 'A long formatted date '.repeat(80),
        labels: { title: 'Upcoming events' },
        footer: 'More details · '.repeat(100),
      },
    ),
  ];

  for (const embed of embeds) {
    const total = (embed.title?.length ?? 0)
      + (embed.description?.length ?? 0)
      + (embed.author?.name?.length ?? 0)
      + (embed.footer?.text?.length ?? 0)
      + (embed.fields ?? []).reduce((sum, field) => sum + field.name.length + field.value.length, 0);
    assert.ok(total <= 6000, `aggregate embed text was ${total} characters`);
    assert.ok(embed.fields.length <= 25);
    assert.ok(embed.fields.every((field) => field.name.length <= 256 && field.value.length <= 1024));
  }
});
