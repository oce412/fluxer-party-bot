# Privacy Policy — Fluxer Party Bot

**Last updated:** 27 November 2026  
**Operator:** oce412  
**Bot name:** Juke (Fluxer Party Bot)  
**Privacy contact:** [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com)

## 1. About the bot

Juke helps Fluxer communities create and announce events, collect RSVPs, manage recurring events, and send event-related reminders and notifications. Community settings and event records are stored separately for each community.

## 2. Information the bot stores

Depending on how a community uses the bot, the following information may be stored:

- **Community settings:** community ID, announcement-channel ID, language, default time zone, default event duration, and whether private DM controls are enabled.
- **Event details:** event title and description, start date and time, time zone, duration, recurrence settings, event status, announcement channel and message IDs, and the host's Fluxer user ID and display name.
- **RSVPs:** the Fluxer user ID and captured username or display name of each attendee, together with their RSVP status (such as attending or maybe).
- **Personal time-zone preferences:** a member's preferred display time zone, if they choose to set one.
- **Notification records:** recipient IDs and delivery status used to avoid sending the same event reminder or update repeatedly.
- **Operational logs:** service status, community/channel/event identifiers, counts, and error information needed to diagnose problems. Logs are written to the hosting platform's standard output and may be collected by FluxerHost.

The bot processes supported commands and wizard replies in memory to perform the requested action. It is not designed to archive ordinary community conversations, and the application does not intentionally store general message history or arbitrary chat messages.

## 3. How the information is used

The information above is used to publish and manage events, maintain RSVP lists, apply community settings, display event times, schedule reminders, deliver event-related notifications, prevent duplicate messages, and diagnose or protect the service.

The bot does not use this information for advertising or sell it to advertisers.

## 4. Commands, private messages and notifications

By default, commands sent in a community are answered in that community's channel.

A community administrator can optionally enable **private DM controls** in the setup wizard or with `!event setup dm on`. When enabled, members can use private messages for supported event commands and guided event creation or management. The setting can be disabled again with `!event setup dm off`.

The bot may also send event-related private messages to hosts and members who have RSVP'd, for reminders, event-start notices, or relevant host/event updates. These messages are tied to the event and the bot's configured notification features. If a private message cannot be delivered, the bot may post a fallback notice in the event's configured channel and identify only the intended recipients.

## 5. Where information is stored

The bot application and its PostgreSQL database are hosted by **FluxerHost**. PostgreSQL runs in a persistent container. This project uses FluxerHost's **EU infrastructure**.

FluxerHost describes its hosting environment as Kubernetes-based and says its staff may access project data when needed for technical support, troubleshooting, or compliance with its terms. See the [FluxerHost hosting overview](https://fluxer.host/about) and [FluxerHost privacy policy](https://fluxer.host/privacy) for the host's own processing practices.

Fluxer operates the platform, accounts and messaging infrastructure under its own terms and privacy policy. The bot operator does not control Fluxer's platform-side processing.

The project has optional language-request and translation-submission forms that may use Google Forms. These forms are not currently publicly enabled. If they are enabled in the future, information submitted through them will also be handled by Google under Google's own terms and privacy policy.

## 6. Retention and deletion

**While the bot remains in a community:** event records, RSVP information, community settings and saved time-zone preferences remain in the active database. The bot currently has no automatic age-based expiry for event history. This means those records may remain until they are deleted by a community-removal cleanup or a verified deletion request.

**When the bot is removed from a community:** after receiving Fluxer's permanent community-removal event, the bot deletes that community's event records (including RSVPs and notification records), community settings, and member time-zone preferences from its active PostgreSQL database. A temporary Fluxer outage is not treated as removal and does not trigger deletion.

**Individual deletion requests:** members and community administrators can request access to or deletion of relevant information by emailing [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com). Include the Fluxer user ID and, where relevant, the community and event concerned. The operator may ask for reasonable information to verify the request or the requester's authority. A community administrator may be asked to verify a request relating to community-wide records.

**Backups and hosting logs:** the application does not schedule its own automatic database backups or set an automatic expiry for manual backup files. FluxerHost may maintain infrastructure backups or snapshots and may collect application logs. Those copies are managed under FluxerHost's own retention practices, not by the bot's community-removal cleanup. FluxerHost's public policy does not state a fixed deletion period for backups or logs; see its [privacy policy](https://fluxer.host/privacy).

## 7. Your data-protection rights

Depending on the law that applies and the legal basis for a particular use of data, you may be entitled to request access to your personal data, have inaccurate information corrected, request deletion or restriction of processing, receive a portable copy of data you provided, or object to certain processing. Where processing is based on consent, you may withdraw that consent; withdrawal does not affect processing carried out before it was withdrawn.

You may also lodge a complaint with the data-protection supervisory authority responsible for your location. Contact the operator first at [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com) so the request can be reviewed and, where appropriate, resolved.

## 8. Security

The operator takes reasonable steps to protect the bot and its stored information, including restricting database access, keeping credentials in hosting secrets, using database TLS where supported, and applying database migrations. No online service can guarantee absolute security.

## 9. Contact and policy updates

For questions, access requests, corrections, or deletion requests, email [partybotfluxer@gmail.com](mailto:partybotfluxer@gmail.com). Include the Fluxer user ID and relevant community/event information, but do not send passwords, bot tokens or database credentials.

This policy may be updated when the bot, its data practices, or its service providers change. The latest version should be published at a stable public URL and linked from the bot's listing.

---

**Publication note for the operator:** this is still a draft, not legal advice. Before publishing, confirm the controller's full identity (a public handle alone may not be sufficient), the legal basis for each processing purpose, and which jurisdiction's supervisory authority and additional notices apply. GDPR Article 13 requires transparency about controller identity/contact details, purposes and legal basis, recipients, retention and data-subject rights. See [GDPR Article 13](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).
