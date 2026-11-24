# FluxerList listing draft

**Status: do not submit until the privacy-policy and operator fields below are completed.**

## Suggested listing copy

**Display name:** Confirm the final public name. The repository is named “Fluxer Party Events Bot”; the current privacy-policy draft calls the bot “Juke”. Use one name consistently.

**Short description (under 160 characters):**

> Create community events, collect RSVPs, manage recurring schedules, and send reminders in members' time zones.

**Long description:**

> Plan community events without leaving Fluxer. Create one-off or recurring events, collect yes/maybe/no RSVPs, show attendee capacity, and let hosts reschedule, update details, finish, or cancel events. Members can manage their event time zone, and hosts can send optional start notifications. Commands work in server channels and private messages, with a guided creation wizard and English/Russian interface. Event announcements use rich embeds when the bot has Embed Links permission, with a plain-text fallback for existing installations.

## Suggested tags

Events · Community · Scheduling

Check the current FluxerList tag vocabulary before submitting.

## Commands

The bot uses the `!` prefix:

- `!event help` — server help
- `!event create` — guided event creation
- `!event create | ...` — advanced pipe-delimited creation
- `!event list` — upcoming events
- `!event info ID` — event details and attendees
- `!event rsvp ID yes|maybe|no` — RSVP
- `!event cancel ID` — cancel your own event
- `!event manage ID` — host controls
- `!event setup` — guided server setup (administrators)
- `!event myzone Europe/Amsterdam` — personal display time zone
- `!event zones` — time-zone examples
- `!event language` — language support and credits

In DMs, use `!event server` to choose or switch communities. The current community is remembered for 10 minutes after the latest event command.

## Invite permissions

Generate the OAuth2 invite from the configured application ID with `npm run invite`. It requests the `bot` scope and the following least-privilege permission set:

- Minimum: `85056` — View Channel, Send Messages, Add Reactions, Read Message History, Embed Links.
- Recommended: `93248` — the minimum set plus optional Manage Messages.
- Administrator is not requested.

See [Invite permissions](INVITE_PERMISSIONS.md). Existing installations must be re-authorized or have Embed Links granted to the bot role to show rich announcement embeds.

## Data and privacy disclosure for the listing

This is an implementation summary, not a substitute for the final privacy policy.

- Fluxer delivers message events to the bot. The bot inspects supported `!event` command messages and wizard replies in memory; arbitrary conversation messages are not stored by the application.
- When a member uses DM commands or switches communities, the bot checks that member's membership in communities where it is installed to find valid choices. It does not enumerate, archive, or export full community member lists.
- Stored records include server IDs and settings; event titles, descriptions, dates, time zones, duration, recurrence, host IDs/display names, channel/message IDs and status; RSVP user IDs, usernames/display names and RSVP status; reminder/notification delivery state; and member time-zone preferences.
- Operational logs are structured JSON and may contain event/server/channel IDs, error messages, counts and service health. Token-like strings, secret fields, and common database connection strings are redacted. The logger does not intentionally log arbitrary message content or attendee lists.
- The bot sends event-related DMs to hosts and members who RSVP yes/maybe for reminders or explicitly enabled start notifications. If delivery fails, it can post a fallback notice in the event channel and mention only the intended recipients. It does not send promotional broadcasts.
- The bot container is hosted through FluxerHost. Its published description says projects run in dedicated Kubernetes namespaces; its privacy policy permits project-data access for support, troubleshooting, and compliance. The production event/settings data is stored in PostgreSQL via `DATABASE_URL`; confirm whether that database is inside FluxerHost or a separate service and record its actual region.
- Application event/settings records are retained indefinitely until the operator manually deletes them. The app does not automatically purge records when the bot leaves a community. Backup and platform-log retention are controlled by the configured storage/hosting arrangements and must be confirmed; do not invent a number.
- `LANGUAGE_REQUEST_FORM_URL` and `LANGUAGE_SUBMISSION_FORM_URL` may be configured. When used, those external form providers and the data sent to them must be disclosed.
- The application has no automatic event-retention or server-removal deletion job. Event records remain in storage until the operator deletes them through database maintenance. Set and publish an actual retention/deletion procedure before launch.

## AI and voice disclosure

For the current code changes, the accurate FluxerList selection is **Some AI use**: AI assistance was used for part of the code review/implementation and project documentation. The bot itself has no AI-powered chat/generation feature and does not call an AI model API. It has no voice/audio feature. Re-check this declaration against the full project history before submitting.

## Required before submission

- [ ] Confirm the public bot name and Fluxer application/bot ID.
- [ ] Publish a final privacy policy at a stable public HTTPS URL. Replace every placeholder in `PRIVACY_POLICY_DRAFT.md`, including operator identity, privacy contact, database and app hosting providers/regions, configured form providers, retention for primary data/backups/logs, deletion process, and applicable legal basis/transfer details.
- [ ] Provide a working privacy-request contact and a support/community URL.
- [ ] Decide and document data retention and a deletion process, including what happens after the bot is removed from a community.
- [ ] Verify the production invite URL and permissions using `npm run invite`.
- [ ] Verify the production bot responds promptly, has no unsolicited join messages, and only sends event-triggered notifications described above.
- [ ] Test first install, Embed Links granted, Embed Links absent, RSVP updates, cancellation/status updates, DMs, English and Russian, and database restore.
- [ ] Review the final listing against the current [FluxerList bot submission guide](https://docs.fluxerlist.com/bots) and [bot guidelines](https://docs.fluxerlist.com/bot-guidelines).

Do not publish this draft as the live privacy policy. It intentionally records the remaining operator decisions rather than guessing them.
