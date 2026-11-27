# Privacy Notice — Juke (Fluxer Party Bot)

**Last updated:** 28 November 2026  
**Project operator:** oce412  
**Privacy contact:** [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com)

This notice explains what Juke processes when a Fluxer community adds and uses the bot, why that information is needed, where it is stored, and how to ask questions or request deletion.

## 1. What Juke does

Juke helps Fluxer communities create and announce events, collect RSVPs, manage recurring events, and send event-related reminders and notifications. Community configuration and event records are separated by community ID.

## 2. Information processed

Depending on the features a community and its members use, Juke stores:

- **Community settings:** community ID, announcement-channel ID, selected language, default time zone, default event duration, and the community's private-DM-controls preference.
- **Event information:** event title and description, scheduled date and time, time zone, duration, recurrence settings, status, event/channel/message IDs, and the host's Fluxer user ID and display name.
- **RSVP information:** the Fluxer user ID, captured username or display name, and RSVP choice (attending, maybe, or not attending).
- **Personal time-zone preferences:** a member's preferred time zone, if they set one.
- **Notification records:** recipient IDs and delivery status used to prevent duplicate reminders or event notifications.
- **Operational logs:** service status, community/channel/event identifiers, counts, and error information used to operate and troubleshoot the bot. Logs are written to standard output and may be collected by FluxerHost.

Fluxer sends message events to the bot so it can recognise commands and wizard replies. The bot processes supported commands and replies in memory. The application is not designed to archive ordinary community conversations and does not intentionally store general message history or arbitrary chat messages.

## 3. Why the information is used

Juke uses this information to publish and manage events, maintain RSVP lists, apply community settings, display event times, schedule and deliver event-related notifications, prevent duplicate messages, and diagnose or protect the service.

The bot does not use the stored information for advertising and does not sell it. The running bot does not send community data to an AI model or use an AI API.

## 4. Server replies, private messages and notifications

Routine commands in a community are answered in the server channel by default.

The administrator setup command, `!event setup`, is an exception: it opens a private multi-step setup wizard and asks the administrator whether private DM controls should be enabled. The one-setting commands `!event setup dm on` and `!event setup dm off` reply in the channel.

Private DM controls are **off by default** for each community. When a community administrator enables them, supported community event commands and guided event creation/management can be used through private messages. An administrator can turn them off again with `!event setup dm off`. A user who starts a conversation with the bot in DMs receives replies in that DM, subject to the community's settings for community-specific commands.

Juke may also send event-related DMs to the host and relevant attendees, for example for reminders, event-start notices, or host/event updates. These are separate from routine command replies. If a DM cannot be delivered, the bot may post a fallback notice in the event's configured channel and identify only the intended recipients.

## 5. Where information is stored and who provides services

The Juke application and its PostgreSQL database run on **FluxerHost's EU infrastructure**. The database is a persistent PostgreSQL container hosted through FluxerHost.

FluxerHost provides the hosting infrastructure. Its staff may access project data when necessary for support, troubleshooting, or compliance with its terms. See the [FluxerHost hosting overview](https://fluxer.host/about) and [FluxerHost privacy policy](https://fluxer.host/privacy) for information about the host's own processing.

Fluxer provides the messaging platform, accounts, and gateway/API through which the bot operates. Fluxer's own platform-side processing is governed by Fluxer's terms and privacy information; it is not controlled by the Juke operator.

The bot has optional language-request and translation-submission form integrations, but those forms are not currently publicly enabled. This notice will be updated before they are enabled.

## 6. How long information is kept

**While Juke remains in a community:** event history, RSVPs, community settings, notification records, and saved time-zone preferences remain in the active database. The bot currently has no automatic age-based expiry for event history. Records therefore remain until a deletion event or a verified deletion request is processed, or the operator otherwise removes them.

**When Juke is permanently removed from a community:** when the bot receives Fluxer's permanent community-removal event, it deletes that community's event records (including RSVPs and notification records), settings, and member time-zone preferences from its active PostgreSQL database. A temporary Fluxer outage is not treated as removal and does not trigger deletion. This cleanup is scoped to the removed community and does not delete other communities' information.

**Individual access or deletion requests:** members and community administrators can request access to, correction of, or deletion of relevant information by emailing [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com). Include your Fluxer user ID and, where relevant, the community and event IDs. The operator may ask for reasonable information to verify identity or authority before acting on a request.

**Backups and hosting logs:** the application does not schedule its own automatic database backups or automatically expire manual backup files. FluxerHost may maintain infrastructure backups/snapshots and collect application logs. These are managed under FluxerHost's own retention practices and are not removed by the bot's active-database cleanup. FluxerHost's public privacy policy does not specify a fixed retention period for backups or logs; consult its [privacy policy](https://fluxer.host/privacy).

Messages already sent to Fluxer channels or DMs are part of Fluxer's platform and are subject to Fluxer's own retention and deletion controls. Removing database records does not itself erase copies of messages held by Fluxer.

## 7. Your choices and data-protection rights

You can ask the operator about information associated with your Fluxer user ID and request access, correction, deletion, or restriction of processing. Depending on the data-protection law that applies, you may also have rights to object to certain processing, request data portability, or complain to a supervisory authority.

Contact [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com) to exercise a right or ask a question. The operator may need to verify your identity or your authority to make a community-level request. Requests are handled under the requirements of applicable law.

## 8. Security

The operator takes reasonable steps to protect the bot and stored information, including restricting database access, keeping credentials in the hosting platform's secret manager, using database TLS with certificate verification where supported, and applying database migrations. No online service can guarantee absolute security.

## 9. Contact and updates

For privacy questions, access requests, corrections, or deletion requests, email [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com). Do not send passwords, bot tokens, or database credentials.

This notice may be updated when Juke's features, data practices, or service providers change. The latest version is published in the project's [public GitHub repository](https://github.com/oce412/fluxer-party-bot).

---

**Important operator note:** this page describes the bot's current technical behavior. Before presenting it as a final GDPR notice or submitting the bot to a public listing, the operator still needs to confirm the controller's full legal identity and the applicable legal basis for each processing purpose. GDPR Articles 13 and 14 require, among other things, controller identity/contact details and the purposes and legal basis of processing. See the [official GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).
