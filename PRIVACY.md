# Privacy Notice — Juke (Fluxer Party Bot)

**Last updated:** 28 November 2026  
**Data controller / operator:** The independent developer operating Juke, known in the Fluxer community as **fuckDiscord#6219**  
**Privacy contact:** [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com)

This notice explains what Juke processes when a Fluxer community adds and uses the bot, why that information is needed, where it is stored, and how people can contact the operator about their information.

## 1. What Juke does

Juke helps Fluxer communities create and announce events, collect RSVPs, manage recurring events, and send event-related reminders and notifications. Community configuration and event records are separated by community ID.

## 2. Information processed

Depending on the features a community and its members use, Juke processes and stores:

- **Community settings:** community ID, announcement-channel ID, selected language, default time zone, default event duration, and the community's private-DM-controls preference.
- **Event information:** event title and description, scheduled date and time, time zone, duration, recurrence settings, status, event/channel/message IDs, and the host's Fluxer user ID and display name.
- **RSVP information:** the Fluxer user ID, captured username or display name, and RSVP choice (attending, maybe, or not attending).
- **Personal time-zone preferences:** a member's preferred time zone, if they set one.
- **Notification records:** recipient IDs and delivery status used to prevent duplicate reminders or event notifications.
- **Operational logs:** service status, community/channel/event identifiers, counts, and error information used to operate and troubleshoot the bot. Logs are written to standard output and may be collected by FluxerHost.

Fluxer sends message events to the bot so it can recognise commands and wizard replies. The bot processes supported commands and replies in memory. The application is not designed to archive ordinary community conversations and does not intentionally store general message history or arbitrary chat messages.

## 3. Purposes and legal basis

Juke uses the information described above to publish and manage events, maintain RSVP lists, apply community settings, display event times, schedule and deliver event-related notifications, prevent duplicate messages, and diagnose or protect the service.

The operator's intended legal basis for the core event-management functions is **legitimate interests** under Article 6(1)(f) of the GDPR. Those interests are enabling Fluxer communities to organise events and coordinate attendance, and operating and protecting the bot. This basis is subject to the processing being necessary for those purposes and not being overridden by the rights and freedoms of the people whose information is processed. A person may object to processing based on legitimate interests; the operator will consider such an objection in accordance with applicable data-protection law.

The bot does not use stored information for advertising and does not sell it. The running bot does not send community data to an AI model or use an AI API.

## 4. Server replies, private messages and notifications

Routine commands in a community are answered in the server channel by default.

The administrator setup command, `!event setup`, is an exception: it opens a private multi-step setup wizard and asks the administrator whether private DM controls should be enabled. The one-setting commands `!event setup dm on` and `!event setup dm off` reply in the channel.

Private DM controls are **off by default** for each community. When a community administrator enables them, supported community event commands and guided event creation/management can be used through private messages. An administrator can turn them off again with `!event setup dm off`. A user who starts a conversation with the bot in DMs receives replies in that DM, subject to the community's settings for community-specific commands.

Juke may also send event-related DMs to the host and relevant attendees, for example for reminders, event-start notices, or host/event updates. These are separate from routine command replies. If a DM cannot be delivered, the bot may post a fallback notice in the event's configured channel and identify only the intended recipients. A member who does not interact with an event or the DM wizard will not receive event-related DMs merely because Juke is present in the community.

## 5. Where information is stored and who provides services

The Juke application and its PostgreSQL database run on **FluxerHost's EU infrastructure**. The database is a persistent PostgreSQL container hosted through FluxerHost. According to the operator's current hosting arrangement, the project's hosting infrastructure and provider-managed backups are located within the EU.

FluxerHost provides the hosting infrastructure. Its personnel may have technical access to the project and stored data for infrastructure maintenance, support, troubleshooting, security, or other purposes permitted by its service terms. The operator controls Juke's application configuration and the purposes for which the bot processes information. See the [FluxerHost hosting overview](https://fluxer.host/about) and [FluxerHost privacy policy](https://fluxer.host/privacy) for information about the host's own processing.

Fluxer provides the messaging platform, accounts, and gateway/API through which the bot operates. Fluxer's own platform-side processing is governed by Fluxer's terms and privacy information and is not controlled by the Juke operator.

The bot has optional language-request and translation-submission form integrations, but those forms are not currently publicly enabled. This notice will be updated before they are enabled.

## 6. How long information is kept

**While Juke remains in a community:** event history, RSVPs, community settings, notification records, and saved time-zone preferences remain in the active database. The bot currently has no automatic age-based expiry for event history. Upcoming events are not automatically removed simply because they are scheduled far in advance. Records remain until they are manually deleted, a deletion request is processed, Juke is permanently removed from the community, or the operator otherwise removes them.

**When Juke is permanently removed from a community:** when the bot receives Fluxer's permanent community-removal event, it deletes that community's event records (including RSVPs and notification records), settings, and member time-zone preferences from its active PostgreSQL database. A temporary Fluxer outage is not treated as removal and does not trigger deletion. This cleanup is scoped to the removed community and does not delete other communities' information.

**Individual access or deletion requests:** members and community administrators can request access to, correction of, or deletion of relevant information by emailing [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com). Include your Fluxer user ID and, where relevant, the community and event IDs. The operator may ask for reasonable information to verify identity or authority before acting on a request. Requests are handled manually and in accordance with applicable law.

**Backups and hosting logs:** the application does not schedule its own automatic database backups or automatically expire manual backup files. FluxerHost may maintain infrastructure backups/snapshots and collect application logs. These are managed separately from Juke's active database and are not automatically removed by the bot's active-database cleanup. The operator does not control the host's backup and log retention schedules; see the [FluxerHost privacy policy](https://fluxer.host/privacy) for information about the host's own practices.

Messages already sent to Fluxer channels or DMs are part of Fluxer's platform and are subject to Fluxer's own retention and deletion controls. Removing database records does not itself erase copies of messages held by Fluxer.

## 7. Your choices and data-protection rights

You can contact the operator about information associated with your Fluxer user ID and, where applicable, request access, correction, deletion, or restriction of processing. Depending on the data-protection law that applies, you may also have the right to object to processing, request data portability, or complain to a supervisory authority.

Contact [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com) to exercise a right or ask a question. The operator may need to verify your identity or your authority to make a community-level request. Requests are reviewed and handled manually under the requirements of applicable law. Some rights are subject to legal conditions and exceptions.

## 8. Security

The operator takes reasonable steps to protect the bot and stored information. Access to the FluxerHost project dashboard is restricted to the operator. FluxerHost personnel may have infrastructure-level access as described above. The bot uses PostgreSQL, uses database TLS with certificate verification where supported and configured, and redacts common secret fields, token-like strings, and database credentials from application logs and error messages.

This notice does not claim that every database field or backup is encrypted at rest. No online service can guarantee absolute security.

If FluxerHost reports a hosting or infrastructure incident, the operator will assess whether Juke-related personal data is affected and take any steps required by applicable data-protection law, including regulatory or individual notifications where legally required.

## 9. Data controller, contact and updates

Juke is operated by an independent developer known in the Fluxer community as **fuckDiscord#6219**.

For privacy questions, access requests, corrections, deletion requests, or other concerns, contact:

- **Email:** [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com)
- **Fluxer:** **fuckDiscord#6219**

Do not send passwords, bot tokens, or database credentials.

This notice may be updated when Juke's features, data practices, or service providers change. The latest version is published in the project's [public GitHub repository](https://github.com/oce412/fluxer-party-bot).
