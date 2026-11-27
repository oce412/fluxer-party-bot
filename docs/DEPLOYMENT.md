# Production deployment runbook

## Before deploying

1. Create a dedicated production Fluxer application and bot token. Do not reuse development credentials.
2. Create a dedicated PostgreSQL database/user for this bot. Do not point development and production at the same database.
3. Restrict database network access to the application host. Enable TLS and keep certificate verification enabled.
4. Store all credentials in the hosting platform's runtime secret manager. Never commit `.env.production`, tokens, or database passwords.
5. Set the production bot role to the permissions documented in [INVITE_PERMISSIONS.md](INVITE_PERMISSIONS.md). Do not grant Administrator.

## Required production environment

Use `.env.production.example` as the source of truth. Required values:

| Variable | Purpose |
|---|---|
| `APP_ENV=production` | Activates production safeguards and container entrypoint |
| `FLUXER_BOT_TOKEN` | Runtime bot token secret |
| `DATABASE_URL` | Dedicated PostgreSQL connection string |
| `DATABASE_SSL=true` | Enables TLS for PostgreSQL |
| `DATABASE_SSL_REJECT_UNAUTHORIZED=true` | Verifies the database server certificate |
| `DATABASE_SSL_CA` | Optional path to the provider CA certificate for `pg_dump`; otherwise libpq uses its default trusted root certificate path |

Recommended values:

| Variable | Purpose |
|---|---|
| `EXPECTED_BOT_USER_ID` | Prevents accidentally starting with a token for another bot |
| `BUILD_REVISION` | Git commit SHA reported by `GET /healthz`; can be set as a runtime environment variable |
| `FLUXER_APPLICATION_ID` | Used by `npm run invite` to generate the OAuth2 invite |
| `BOT_LANGUAGE=en` | Fallback language for unconfigured communities |
| `EVENT_DEFAULT_TIME_ZONE=UTC` | Default event time zone |
| `DATA_DIR=data-production` | Local data/import directory |
| `DATABASE_POOL_MAX=5` | PostgreSQL pool size; code clamps it to 1–20 |
| `LOG_LEVEL=info` | Structured application log level |
| `HEALTH_PORT` or `PORT` | Optional health/readiness listener |
| `LANGUAGE_REQUEST_FORM_URL` | Optional HTTPS language-request form |
| `LANGUAGE_SUBMISSION_FORM_URL` | Optional HTTPS translation-submission form |

Use a production PostgreSQL connection with least-privilege access. Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=true`; do not disable certificate checks to make an invalid TLS configuration work. The backup script uses the same setting: `verify-full` by default, `require` only when certificate verification is explicitly disabled, and `DATABASE_SSL_CA` when your provider supplies a dedicated CA file.

## Container deployment

The repository Dockerfile uses Node.js 24, installs locked production dependencies with `npm ci --omit=dev`, runs as the unprivileged `node` user, and copies only runtime files. It accepts `--build-arg BUILD_REVISION=<git-sha>` and exposes that marker through `/healthz`. Set the same value as a runtime `BUILD_REVISION` environment variable when building outside GitHub Actions.

The container entrypoint refuses startup unless `APP_ENV=production`, `FLUXER_BOT_TOKEN`, and `DATABASE_URL` are present. It runs database migrations before starting the bot. Deploy the image produced by the trusted master/tag workflow and pin the deployed image to an immutable digest where the hosting platform supports it. Pull-request Docker builds are validation-only and do not publish an image. Feature branches are not published by the current workflow; when testing a feature branch on FluxerHost, build from the exact branch/commit or ask the host operator to update the project to that revision.

Persistent event and settings data is in PostgreSQL. The local `DATA_DIR` is used for legacy JSON import/backup-related files; do not rely on the container's writable layer as durable storage.

## Non-container deployment

On a host with Node.js 24:

```sh
npm ci
npm run check
npm test
npm run start:prod
```

Provide the same production variables through the host's secret/environment manager. Startup applies migrations through store initialization. For an explicit migration run, use `npm run db:migrate` with the production environment loaded.

## Health and readiness

When `HEALTH_PORT` or `PORT` is set, the bot serves:

- `GET /healthz` — process health, package version and source revision.
- `GET /readyz` — readiness, including Fluxer gateway and storage health, plus the same version/revision marker.

For a feature-branch deployment, compare the `revision` returned by `/healthz` with the current head SHA shown on GitHub for the branch you intended to deploy; `unknown` means the host has not been configured to pass the build revision through.

The Docker health check uses `/readyz`. Keep the health port reachable by your platform's health checker but do not expose an unnecessary management surface to the public internet.

## Backups, retention and recovery

- Schedule `npm run db:backup` from a trusted host with the required PostgreSQL tools and credentials.
- Store backups encrypted, separately from the production database, with access restricted to operators who need restore capability.
- Define the backup retention period in the hosting/backup system; the application does not enforce it.
- When the bot receives a permanent Fluxer community-removal event, it deletes that community's events, RSVPs, settings and member time-zone preferences from the active database. This does not erase host-managed backup snapshots or platform logs; their retention is controlled by FluxerHost.
- Regularly test restoring a backup into a separate database. A backup that has not been restored in a test is not a verified recovery plan.
- Database migrations are additive and transactional; take a verified backup before deploying a release that changes schema.
- Keep the prior immutable application image available so the application process can be rolled back. If a migration has already run, confirm backward compatibility before rolling back the application; restore the database only using a documented recovery decision.

## Release verification

After deployment:

1. Confirm `/healthz` reports the intended version and exact source revision (not `unknown`).
2. Create a **new test event** and check its announcement and DM `!event info ID` output. New posts use embeds immediately. Existing announcements are not bulk-converted at startup; they are refreshed to embeds after an RSVP or host edit/status change.
3. Confirm the bot logs in as the expected bot identity and `/readyz` returns HTTP 200.
4. In a test community, run `!event setup`, create an event, RSVP yes/maybe/no, and use host controls to edit and cancel it.
5. Repeat with a bot role that has Embed Links and with a test role that does not; verify rich embed and text fallback respectively.
6. Verify that server commands reply in-channel with DM controls disabled by default; enable them with `!event setup dm on`, confirm DM commands and guided creation/management work, then disable them with `!event setup dm off` and confirm replies return to the server channel.
7. Verify DMs, community switching, English/Russian locale, and time-zone rendering.
8. Confirm scheduled reminders/notifications are event-triggered and only sent to the host and relevant attendees.
9. Verify PostgreSQL backup and restore from the deployed release.

## Public launch gate

Do not treat a healthy container as proof that the service is ready for broad public use. Before listing, complete the privacy policy, name a privacy/support contact, identify hosting and subprocessors/regions, publish retention and deletion procedures, and verify the production bot invite against the current Fluxer permissions documentation.
