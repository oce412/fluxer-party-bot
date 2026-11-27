# FluxerList listing draft

**Status:** Draft — submit after the live behavior and privacy details have been verified.

## Suggested listing copy

**Display name:** Juke (Fluxer Party Bot)

**Short description (under 160 characters):**

> Create community events, collect RSVPs, manage recurring schedules, and send reminders in members' time zones.

**Long description:**

> Plan community events without leaving Fluxer. Create one-off or recurring events, collect yes/maybe/no RSVPs, show attendee capacity, and let hosts reschedule, update details, finish, or cancel events. Commands and replies stay in server channels by default. Community administrators can optionally enable private DM controls for event commands and guided creation/management. The bot includes English and Russian interfaces and sends event-related reminders and notifications.

## Suggested tags

Events · Community · Scheduling

Check the current FluxerList tag vocabulary before submitting.

## Commands

The bot uses the `!` prefix:

- `!event help` — server help
- `!event create` — guided event creation (requires private DM controls to be enabled)
- `!event create | ...` — create an event with the advanced one-line syntax
- `!event list` — upcoming events
- `!event info ID` — event details and attendees
- `!event rsvp ID yes|maybe|no` — change RSVP
- `!event cancel ID` — cancel your own event
- `!event manage ID` — host controls (requires private DM controls to be enabled)
- `!event setup` — guided server setup (administrators)
- `!event setup dm on|off` — enable or disable private DM controls
- `!event myzone Europe/Amsterdam` — personal display time zone
- `!event zones` — time-zone examples
- `!event language` — language support and credits

Private commands require the community administrator to enable private DM controls. When enabled, use `!event server` in DMs to select or switch the community. The selection is remembered for 10 minutes after the latest event command.

## Invite permissions

Generate the OAuth2 invite from the configured application ID with `npm run invite`. It requests the `bot` scope and the following least-privilege permission set:

- Minimum: `85056` — View Channel, Send Messages, Add Reactions, Read Message History, Embed Links.
- Recommended: `93248` — the minimum set plus optional Manage Messages.
- Administrator is not requested.

See [Invite permissions](INVITE_PERMISSIONS.md). Existing installations must be re-authorized or have Embed Links granted to the bot role to show rich announcement embeds.

## Data and privacy disclosure

This is a summary for the listing, not a substitute for the full [privacy policy](PRIVACY_POLICY_DRAFT.md).

- Fluxer delivers message events to the bot. Supported command messages and wizard replies are processed in memory; the application does not intentionally store general conversation history or arbitrary chat messages.
- Stored records include community IDs and settings (language, time zone, announcement channel, duration and DM-controls preference); event titles/descriptions, date/time, time zone, duration, recurrence, host IDs/display names, channel/message IDs and status; RSVP user IDs, usernames/display names and RSVP status; personal time-zone preferences; and notification delivery records.
- Operational logs may contain community, channel and event identifiers, error messages, counts and service health. The logger redacts common secret fields, token-like strings and database credentials.
- Commands in server channels are answered in the channel by default. DMs for event commands and guided creation/management are enabled only when a community administrator opts in. Event reminders and related notifications may be sent to hosts and members who RSVP or are included in an enabled event notification.
- The bot application and PostgreSQL persistent container are hosted through FluxerHost's **EU infrastructure**. FluxerHost describes its Kubernetes-based hosting and its staff-access conditions in its [hosting overview](https://fluxer.host/about) and [privacy policy](https://fluxer.host/privacy).
- While the bot remains installed, event and community records have no automatic age-based expiry. When the bot receives the permanent community-removal event, it deletes that community's events, RSVPs, settings and saved time-zone preferences from the active database.
- Members and community administrators can request access, correction or deletion by emailing **partybotfluxer@gmail.com**. FluxerHost-managed backups and hosting logs are separate from the bot's active database cleanup and follow the host's own retention practices.
- Optional language-request or translation forms may use Google Forms. They are not currently publicly enabled; disclose the form and data collected if they are enabled later.

## AI and voice disclosure

For the current code changes, the accurate FluxerList selection is **Some AI use**: AI assistance was used for part of the code review/implementation and project documentation. The bot itself has no AI-powered chat/generation feature and does not call an AI model API. It has no voice/audio feature. Re-check this declaration against the full project history before submitting.

## Required before submission

- [ ] Confirm the public bot name and Fluxer application/bot ID.
- [ ] Publish the privacy policy at a stable public HTTPS URL. Confirm the controller's full identity, applicable legal basis for each purpose, the relevant supervisory authority, and any additional rights/notice requirements before publication.
- [ ] Verify the privacy-request email and provide a support/community URL.
- [ ] Verify that removal cleanup works in the live Fluxer environment, and separately confirm any FluxerHost backup/log retention details you wish to state.
- [ ] Verify the production invite URL and permissions using `npm run invite`.
- [ ] Test default channel replies, DM controls disabled/enabled, first install, Embed Links granted/absent, RSVP updates, cancellation/status updates, DMs, English and Russian, and database restore.
- [ ] Review the final listing against the current [FluxerList bot submission guide](https://docs.fluxerlist.com/bots) and [bot guidelines](https://docs.fluxerlist.com/bot-guidelines).

Do not submit this draft until the remaining checks are complete.
