# Changelog

## v0.8.1 — container deployment preparation

- Added a non-root production Docker image with dependency installation from a locked npm dependency tree.
- Added an entrypoint that validates production environment configuration and runs migrations before starting the bot.
- Added Docker readiness health checks that use `/readyz`.
- Added a local Compose staging stack with a separate disposable PostgreSQL database.
- Added container build, smoke-test, backup/restore, rollback, and FluxerHost handoff instructions.
- Excluded environment files, local data, test data, backups, and developer artifacts from the Docker build context.
- The current release remains a single-worker deployment; multiple replicas are not supported until a distributed scheduler lock and cross-process consistency are implemented.

## v0.8.2 — reliability and input improvements (in development)

- Add an optional, persistent event-start DM for the host and yes/maybe attendees.
- Accept one- or two-digit hours when creating and rescheduling events.
- Accept UTC/GMT fixed offsets alongside IANA time zones; fixed offsets do not observe daylight saving changes.
- Fall back to the server duration for malformed or out-of-range optional duration input.
- Return the original event-creation command when validation fails.

## v0.10 — optional weekly Markiplier clip Easter egg (in development)

- Add an optional 1-in-100 roll once per UTC ISO week to post one random HTTPS clip from a configured list to one configured channel.
- Persist each weekly roll and pending delivery in the destination community's existing settings, without adding a separate scheduler or database table.
- Keep the feature disabled unless both the destination channel and clip list are configured.

## v0.9.1 — Presentation and localization (in development)

- Replace event announcement text cards with localized rich embeds that refresh in place when RSVPs or event status change.
- Use rich embeds for private event lists and event details in DMs.
- Add `!event language credits` / `!событие язык авторы`, sourcing opt-in contributor credits and display names from locale-file metadata.
- Include Fluxer's `EMBED_LINKS` permission in generated minimum and recommended bot invite URLs; keep a text-card fallback for existing installations without that permission.
- Document the minimum permission set and the optional `MANAGE_MESSAGES` permission without requesting Administrator.

## v0.9.0 — DM event workflow (in development)

- Add per-user community selection for event commands in DMs, with membership checks before each operation.
- Support guided event creation in server channels and DMs, plus the existing advanced command format.
- Add server selection, list, info, RSVP, cancel and host management from DMs.
- Include community and announcement-channel pointers in event detail responses.
- Re-check the user's membership in the selected community before every DM action; DM event management remains host-only.
- Scope DM community selection to a 10-minute sliding idle window; pin the selection only while the creation wizard is active.
- Harden membership lookups against different client collection shapes and re-check membership before dispatch.
- Await Fluxer.js `guild.members.resolve()` and treat `MEMBER_NOT_FOUND` / `UNKNOWN_MEMBER` as a normal non-member result in DM and admin checks.
- Make event listing tolerate incomplete event/attendee payloads and split long DM responses into safe message sizes.
