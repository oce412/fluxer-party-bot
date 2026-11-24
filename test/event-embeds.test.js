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

test('builds a scheduled announcement embed with localized display fields', () => {
  const embed = buildEventAnnouncementEmbed(event, {
    when: 'Dec 5, 2026, 18:00',
    duration: '2h',
    noLimitLabel: 'no limit',
    maybeLabel: 'Maybe',
    whenLabel: 'Starts',
    attendeesLabel: 'Places',
    durationLabel: 'Length',
    hostLabel: 'Host',
    footer: 'Event ID: A1B2C3D4',
  });
  assert.equal(embed.author.name, 'Host · Alex Example');
  assert.equal(embed.title, '🎉 Board Game Night');
  assert.equal(embed.description, 'Bring your favourite game.');
  assert.equal(embed.color, getEventEmbedColor('scheduled'));
  assert.ok(embed.fields[0].name.includes('Starts'));
  assert.ok(embed.fields[1].name.includes('Places'));
  assert.ok(embed.fields[2].name.includes('Length'));
  assert.equal(embed.fields[1].value, '**2/12 · Maybe: 1**');
  assert.equal(embed.footer.text, 'Event ID: A1B2C3D4');
});

test('announcement embeds reflect event status and omit an empty description', () => {
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
    footer: 'Event ID: A1B2C3D4',
  });
  assert.match(embed.title, /Cancelled/);
  assert.equal(embed.color, getEventEmbedColor('cancelled'));
  assert.equal(Object.hasOwn(embed, 'description'), false);
  assert.equal(embed.fields[1].value, '**0 · no limit**');
});

test('builds a DM details embed with community, channel and attendee names', () => {
  const embed = buildEventDetailsEmbed(event, {
    communityName: 'Test Community',
    channelMention: '<#123>',
    when: 'Dec 5, 2026, 18:00',
    duration: '2h',
    labels: {
      community: 'Community',
      announcements: 'Announcements',
      when: 'Start',
      host: 'Host',
      attendees: 'Places',
      duration: 'Duration',
      attendingNames: 'Attending',
      maybeNames: 'Maybe',
    },
    footer: 'Event ID: A1B2C3D4',
  });
  assert.match(embed.description, /Test Community/);
  assert.match(embed.description, /<#123>/);
  assert.equal(embed.fields.find((field) => field.name.includes('Attending')).value, 'Alice, Bob');
  assert.equal(embed.fields.find((field) => field.name.includes('Maybe')).value, 'Charlie');
  assert.equal(embed.color, getEventEmbedColor('scheduled'));
});

test('builds a single DM list embed with one field per upcoming event', () => {
  const embed = buildUpcomingEventsEmbed([event, { ...event, id: 'E5E5E5E5', title: 'Movie Night' }], {
    communityName: 'Test Community',
    channelMention: '<#123>',
    formatWhen: (item) => item.title,
    labels: {
      title: 'Upcoming events',
      community: 'Community',
      announcements: 'Announcements',
    },
    footer: 'Use !event info ID for more details.',
  });
  assert.ok(embed.title.includes('Upcoming events'));
  assert.match(embed.description, /Test Community/);
  assert.equal(embed.fields.length, 2);
  assert.ok(embed.fields[0].name.includes('Board Game Night'));
  assert.ok(embed.fields[0].name.includes('A1B2C3D4'));
  assert.match(embed.fields[0].value, /👥/);
});

test('embed builders safely truncate user-controlled text and handle missing event data', () => {
  const embed = buildEventAnnouncementEmbed({
    title: 'x'.repeat(400),
    description: 'y'.repeat(5000),
    attendees: 'broken',
    status: 'new-status',
  }, { when: 'z'.repeat(2000), duration: '1h' });
  assert.equal(embed.title.length, 256);
  assert.equal(embed.description.length, 2048);
  assert.equal(embed.fields[0].value.length, 1024);
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
