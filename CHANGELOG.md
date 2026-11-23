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

## v0.9.0 — DM event workflow (in development)

- Add per-user community selection for event commands in DMs, with membership checks before each operation.
- Support guided event creation in server channels and DMs, plus the existing advanced command format.
- Add server selection, list, info, RSVP, cancel and host management from DMs.
- Include community and announcement-channel pointers in event detail responses.
- Re-check the user's membership in the selected community before every DM action; DM event management remains host-only.
- Scope DM community selection to a 10-minute sliding idle window; pin the selection only while the creation wizard is active.
- Harden membership lookups against different client collection shapes and re-check membership before dispatch.
- Make event listing tolerate incomplete event/attendee payloads and split long DM responses into safe message sizes.
