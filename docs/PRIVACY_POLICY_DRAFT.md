# Privacy Policy — Fluxer Party Events Bot (Draft; not yet publishable)

**Status:** Draft — not the final public privacy policy.
**Last reviewed:** 20 October 2026
**Operator:** oce412
**Contact:** fuckDiscord#6219  
**Public bot name:** Juke

## What the bot does

The bot creates and announces community events, stores RSVPs, supports recurring schedules, sends reminders, and lets event hosts manage their events. Each server's configuration and event records are separated by server ID.

## Information processed

Depending on which features a server uses, the bot may store:

- Server ID and server-level settings, including language, time zone, announcement channel and default duration.
- Event title, description, scheduled time, time zone, duration, host's user ID/display name, event/channel/message IDs, recurrence information and event status.
- RSVP user IDs, display names/usernames captured for the RSVP, and RSVP state (attending/maybe).
- Reminder and notification delivery state, such as which recipients have already received a reminder, to avoid duplicates.
- A member's time-zone preference when they set one.
- Operational logs may include event, channel or server identifiers, error messages, counts and service state. They are JSON-formatted and include redaction for common secret fields and token-like strings. The operator should avoid logging message content, event descriptions, attendee lists, bot tokens or database credentials.

The bot does not need to archive general server conversations for its event features. Its command handler receives Fluxer message events, but application code should process the message in memory and should not persist arbitrary message content.

## Why this information is used

The data is used to run requested event features: publish event announcements, manage attendance, apply server-specific settings, schedule reminders, validate host actions, prevent duplicate deliveries, diagnose service failures and protect the service from misuse.

## Where information is stored and service providers

Production event records are stored in PostgreSQL hosted by **[database provider and region]**. The bot runs on **[application host and region]**. Fluxer processes messages and account data under Fluxer's own terms and privacy policy. The bot's operator does not control Fluxer's platform-side processing.

Other connected services: **[list every provider, including error monitoring, logs, forms, backups, or analytics; write “None” only after checking the production configuration]**.

## Direct messages and notification fallback

The bot may send direct messages to a member when that member RSVPs or when they are the host or an interested attendee for a scheduled event. If a direct message cannot be delivered, the bot may post a notification in the event's configured server channel and mention only the affected recipients where possible. The bot should not send promotional or unrelated unsolicited messages.

## Retention and deletion

Event information is retained until **[document the actual retention period and event-history cleanup policy]**. Database backups are retained for **[number of days]**. Operational logs are retained for **[number of days]**. When the bot is removed from a server, **[describe the current deletion workflow and target completion window; do not promise automated deletion unless it is implemented]**.

For access or deletion requests, contact **[privacy contact]** and identify the server and event concerned. Requests will be verified and handled under applicable law. A server administrator may be asked to verify authority for server-level data requests.

## Security

The operator restricts database access, keeps bot tokens and credentials in hosting secrets, uses TLS for database connections where supported, applies schema migrations, and maintains backups. No internet service can guarantee absolute security; suspected data incidents can be reported to **[contact]**.

## International processing and legal basis

The operator and service-provider locations are **[countries/regions]**. If data protection laws such as the GDPR apply, the operator will document the appropriate legal basis and relevant transfer safeguards here after reviewing the actual deployment and user base.

## Changes and contact

This policy may be updated when bot functionality or service providers change. Material changes will be announced through **[support server or project page]**. Contact **[privacy contact]** with questions or requests.
