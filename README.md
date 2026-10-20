# Fluxer Party Events Bot v0.8.1

- **Separate environments:** `.env.development.example` and `.env.production.example`, plus `npm run start:dev` and `npm run start:prod`. Production mode refuses to start without PostgreSQL.
- **Identity guard:** optionally set `EXPECTED_BOT_USER_ID`; the process will stop if a token connects as a different bot account.
- **Versioned PostgreSQL migrations:** additive SQL migrations run transactionally and are tracked in `party_schema_migrations`. A PostgreSQL advisory transaction lock serializes migration startup.
- **Server-isolation helpers and tests:** event ID lookups are scoped to one server; DM management is host-only and an admin cannot cross server boundaries.
- **Structured JSON logs** with redaction for common secret fields and bot-token-like strings.
- **Health endpoints:** optional `/healthz` and `/readyz`; readiness now checks live gateway shard status and store health, and recovers correctly after a resumed session.
- **Backups and public-launch drafts:** `npm run db:backup`, recovery instructions, `docs/PRIVACY_POLICY_DRAFT.md`, `docs/PUBLIC_LISTING.md` and `docs/DEPLOYMENT.md`.
