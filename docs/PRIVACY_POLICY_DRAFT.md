# Privacy Policy — Fluxer Party Events Bot (Draft; not yet publishable)

**Status:** Draft — not the final public privacy policy.
**Last reviewed:** 25 November 2026
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

The bot application is deployed as a Docker container through **FluxerHost (Fluxer Community Hosting)**. FluxerHost describes its project deployments as dedicated Kubernetes namespaces with project credentials isolated from other users ([hosting overview](https://fluxer.host/about)). Its [published privacy policy](https://fluxer.host/privacy) says its staff may access project data for technical support, troubleshooting, or terms compliance. It describes its security measures as reasonable and does not guarantee absolute security.

The bot's event, server-setting, and member time-zone records are stored in **PostgreSQL running in a persistent container hosted through FluxerHost**, using the production `DATABASE_URL`. The database provider is therefore FluxerHost, not a separately selected external database service. The exact physical region of the Kubernetes cluster and the persistent storage backing this database have not been confirmed. FluxerHost advertises an EU infrastructure option ([hosting overview](https://fluxer.host/)), but that does not establish that this particular project uses it. Do not claim EU/EEA or any other specific data residency until FluxerHost confirms the location of the bot workload, PostgreSQL container and persistent volume. Also confirm the locations and retention periods for any platform snapshots or backups.

Fluxer processes message events and account data under Fluxer's own terms and privacy policy. The bot does not operate or control Fluxer's platform-side processing.

Other connected services to disclose in the live listing/policy:
- **Fluxer API/gateway:** receives command messages and supports the bot's event features.
- **FluxerHost:** hosts both the bot application and its persistent PostgreSQL container. Its staff may access project data for the purposes described in its privacy policy.
- **Optional language forms:** `LANGUAGE_REQUEST_FORM_URL` and `LANGUAGE_SUBMISSION_FORM_URL` may link to third-party form providers. Name the provider(s) if either production setting is configured.
- **Logs and backups:** application logs are written to standard output and may be collected by the hosting platform; manual PostgreSQL backups are created with `npm run db:backup`. Confirm the host's log, snapshot and backup retention and whether any separate backup service is enabled.

## Direct messages and notification fallback

The bot may send direct messages to a member when that member RSVPs or when they are the host or an interested attendee for a scheduled event. If a direct message cannot be delivered, the bot may post a notification in the event's configured server channel and mention only the affected recipients where possible. The bot should not send promotional or unrelated unsolicited messages.

## Retention and deletion

**Application data:** the current bot implementation has no automatic event-history expiry, no periodic database cleanup, and no deletion job triggered when the bot is removed from a community. Event records, RSVP identifiers/names, community settings, and saved member time-zone preferences remain in PostgreSQL until the operator deletes them manually through database maintenance or an equivalent administrative process. In practical terms, the current application retention period is **indefinite until manual deletion**.

**Backups:** `npm run db:backup` creates a PostgreSQL dump when an operator runs it; the application does not schedule backups or automatically expire old dump files. The operator must document where backups are stored, who can access them, and the actual deletion schedule. If FluxerHost supplies separate platform snapshots or backups, their retention period must be confirmed with the host.

**Operational logs:** the application writes structured logs to standard output. The hosting platform may collect them; the exact retention period is not stated in the public FluxerHost privacy policy and must be confirmed before publishing a numeric period.

**Hosting-provider retention:** FluxerHost's published privacy policy says project data is retained only as long as necessary to provide the hosting service and removed within a “reasonable timeframe” after hosting is terminated. It does not publish a fixed deletion window or specific backup/log retention periods. This host-level retention statement is separate from the bot application's indefinite retention of records while its PostgreSQL database remains active.

**Server removal:** removing the bot from a community does not currently delete that community's events or settings from PostgreSQL. The operator must handle verified access/deletion requests and manual cleanup. Do not imply that the bot automatically deletes data on leave.

These statements describe the current implementation and publicly available hosting policy as reviewed on 25 November 2026. Re-check provider terms and confirm the actual cluster, persistent-volume, backup and log locations/retention before publishing this policy.

For access or deletion requests, contact **[publish a working privacy contact, e.g. a Fluxer username or support-server channel]** and identify the server and event concerned. Requests will be verified and handled under applicable law. A server administrator may be asked to verify authority for server-level data requests.

## Security

The operator restricts database access, keeps bot tokens and credentials in hosting secrets, uses TLS for database connections where supported, applies schema migrations, and maintains backups. No internet service can guarantee absolute security; suspected data incidents can be reported to **[contact]**.

## International processing and legal basis

The bot and PostgreSQL container are hosted through FluxerHost, but the physical region of the cluster and persistent storage has not yet been confirmed. The operator's own country/region and the applicable legal basis and transfer safeguards are **[complete after review of the actual deployment and user base]**.

## Changes and contact

This policy may be updated when bot functionality or service providers change. Material changes will be announced through **[support server or project page]**. Contact **[privacy contact]** with questions or requests.
