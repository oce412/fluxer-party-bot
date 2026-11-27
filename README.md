# Fluxer Party Events Bot

Juke helps Fluxer communities plan one-off and recurring events, publish announcements, collect RSVPs, and send event-related reminders.

- **Separate environments:** .env.development.example and .env.production.example, plus npm run start:dev and npm run start:prod. Production mode refuses to start without PostgreSQL.
- **Identity guard:** optionally set EXPECTED_BOT_USER_ID; the process stops if a token connects as a different bot account.
- **Versioned PostgreSQL migrations:** additive SQL migrations run transactionally and are tracked in party_schema_migrations. A PostgreSQL advisory transaction lock serializes migration startup.
- **Community isolation:** event lookups are scoped by community ID. DM community selection re-checks membership before actions; host management remains host-only.
- **Privacy controls:** routine server commands reply in-channel by default. Community admins can opt into private DM controls with !event setup dm on and turn them off with !event setup dm off. The admin setup wizard runs in DMs and asks whether to enable the feature. Community data is removed from the active store after permanent bot removal.
- **Event embeds:** announcements, event details and private event lists use localized embeds. RSVP and status changes update announcement embeds in place; a text fallback is used when Embed Links is unavailable.
- **Localization:** English and Russian are included. Language-change confirmations can show opt-in contributor credits from locale metadata; see lang/CONTRIBUTORS.md.
- **Structured logs:** JSON logs redact common secret fields, token-like strings, and PostgreSQL credentials.
- **Health endpoints:** optional /healthz and /readyz. Local checkouts discover the Git revision automatically and mark a dirty working tree; Docker builds report BUILD_REVISION supplied at image build time.
- **Backups and deployment:** npm run db:backup, recovery instructions, and the production runbook in docs/DEPLOYMENT.md.
- **Least-privilege invite:** npm run invite includes Embed Links and does not request Administrator. See docs/INVITE_PERMISSIONS.md.

## Project documentation

- [Public privacy notice](PRIVACY.md)
- [FluxerList listing copy and disclosure checklist](docs/PUBLIC_LISTING.md)
- [Internal privacy publication checklist](docs/PRIVACY_POLICY_DRAFT.md)
- [Production deployment runbook](docs/DEPLOYMENT.md)
- [Invite permissions](docs/INVITE_PERMISSIONS.md)
- [Localization contributor credits](lang/CONTRIBUTORS.md)
