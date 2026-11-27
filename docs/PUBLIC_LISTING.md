# FluxerList listing copy

**Display name:** Juke (Fluxer Party Bot)

## Short description

> Schedule community events, collect RSVPs, manage recurring events, and send reminders in members' time zones.

## Long description

> Juke helps Fluxer communities plan events without leaving Fluxer. Create one-off or recurring events, publish announcements, collect yes/maybe/no RSVPs, track attendee limits, and let hosts update or cancel their events. Routine server commands reply in the channel by default. Community administrators can optionally enable DM-based event commands and guided creation/management. The administrator setup wizard runs privately and asks whether to enable those DM controls. Juke includes English and Russian interfaces, per-user time-zone preferences, and event-related reminders and notifications.

## Suggested tags

Events · Community · Scheduling

Check FluxerList's current tag vocabulary before submitting.

## Commands

Juke uses the ! prefix:

- !event help — show available commands.
- !event setup — administrator-only setup wizard for the announcement channel, default time zone, language, event duration, and optional DM controls. The wizard runs in DMs.
- !event setup dm on|off — enable or disable DM controls for the community; replies in the server channel.
- !event create | Title | YYYY-MM-DD HH:mm | zone/default | limit/none | description/- | repeat | duration-minutes — create an event with the one-line command from a server channel.
- !event create — guided private creation wizard (requires the community administrator to enable DM controls).
- !event list — list upcoming events.
- !event info ID — show event details and attendee information.
- !event rsvp ID yes|maybe|no — update an RSVP.
- !event cancel ID — cancel your own event.
- !event manage ID — open host controls (requires private DM controls).
- !event myzone Europe/Amsterdam — set your personal display time zone.
- !event zones — show time-zone examples.
- !event language — show language support and contributor information.

Routine commands issued in a server channel receive channel replies by default. If an administrator enables DM controls, supported community event commands and guided creation/management can be used in private messages. In DMs, use !event server to select or switch the community. The selection is remembered for 10 minutes after the latest event command.

## Invite permissions

Generate the OAuth2 invite from the configured application ID with npm run invite. It requests the bot scope and a least-privilege permission set:

- Minimum: 85056 — View Channel, Send Messages, Add Reactions, Read Message History, Embed Links.
- Recommended: 93248 — the minimum set plus optional Manage Messages.
- Administrator is not requested.

See [Invite permissions](INVITE_PERMISSIONS.md). Existing installations may need to grant Embed Links to the bot role or relevant channel overrides.

## Data and privacy disclosure

See the [Privacy Notice](../PRIVACY.md).

- Fluxer delivers message events to the bot. Supported command messages and wizard replies are processed in memory; the application does not intentionally store general conversation history or arbitrary chat messages.
- Stored records include community IDs and settings (language, time zone, announcement channel, duration and DM-controls preference); event titles/descriptions, date/time, time zone, duration, recurrence, host IDs/display names, channel/message IDs and status; RSVP user IDs, usernames/display names and RSVP status; personal time-zone preferences; and notification delivery records.
- Operational logs may contain community, channel and event identifiers, error messages, counts and service health. The logger redacts common secret fields, token-like strings and database credentials.
- Routine server commands reply in-channel by default. The !event setup administrator wizard runs in DMs and asks whether to enable DM controls. Community-specific DM commands and guided creation/management are off unless an administrator opts in. Event reminders and related notifications may be sent privately to the host and relevant attendees.
- The bot application and PostgreSQL persistent container are hosted through FluxerHost's **EU infrastructure**. FluxerHost describes its hosting and staff-access conditions in its [hosting overview](https://fluxer.host/about) and [privacy policy](https://fluxer.host/privacy).
- While the bot remains installed, event and community records have no automatic age-based expiry. When the bot receives the permanent community-removal event, it deletes that community's events, RSVPs, settings, notification records and saved time-zone preferences from the active database.
- Members and community administrators can request access, correction or deletion by emailing **partybotfluxer@gmail.com**. FluxerHost-managed backups and hosting logs are separate from the bot's active database cleanup and follow the host's own retention practices.

## AI and voice disclosure

For the current project, the accurate FluxerList selection is **Some AI use**: AI assistance was used for parts of code review/implementation and project documentation. The running bot has no AI-powered chat or generation feature and does not call an AI model API. It has no voice/audio feature.

## Remaining checks before submission

- [ ] Confirm the operator/controller identity to display publicly and document the legal basis for each processing purpose. The privacy notice describes current technical behavior but these legal details still need review.
- [ ] Verify the privacy-request email and provide a support/community URL.
- [ ] Verify the production invite URL and permissions using npm run invite.
- [ ] Confirm the live removal cleanup and the provider's backup/log retention details.
- [ ] Review the final listing against the current [FluxerList bot submission guide](https://docs.fluxerlist.com/bots) and [bot guidelines](https://docs.fluxerlist.com/bot-guidelines).

Do not submit the listing until the remaining identity/legal details are reviewed.
