# Fluxer Party Events Bot

- **Separate environments:** `.env.development.example` and `.env.production.example`, plus `npm run start:dev` and `npm run start:prod`. Production mode refuses to start without PostgreSQL.
- **Identity guard:** optionally set `EXPECTED_BOT_USER_ID`; the process will stop if a token connects as a different bot account.
- **Versioned PostgreSQL migrations:** additive SQL migrations run transactionally and are tracked in `party_schema_migrations`. A PostgreSQL advisory transaction lock serializes migration startup.
- **Server-isolation helpers and tests:** event ID lookups are scoped to one server; DM management is host-only and an admin cannot cross server boundaries.
- **Structured JSON logs** with redaction for common secret fields and bot-token-like strings.
- **Health endpoints:** optional `/healthz` and `/readyz`; readiness now checks live gateway shard status and store health, and recovers correctly after a resumed session.
- **Backups and public-launch drafts:** `npm run db:backup`, recovery instructions, `docs/PRIVACY_POLICY_DRAFT.md`, `docs/PUBLIC_LISTING.md` and `docs/DEPLOYMENT.md`.

- **Rich event presentation:** event announcements, private event lists, and event details use localized embeds. RSVP and status changes update the announcement embed in place; a text fallback keeps older installations working without Embed Links.
- **Localization credits:** `!event language credits` / `!событие язык авторы` reads the language name and opt-in contributor list from each `.lang` file's `# Language:` and repeated `# Contributor:` metadata.
- **Invite permissions:** `npm run invite` includes the required Embed Links permission. See `docs/INVITE_PERMISSIONS.md`; existing installations may need to be re-authorized to receive this permission.

- **Rare Markiplier Easter egg:** optional 1-in-100 weekly roll, sent only to one configured channel from a curated HTTPS URL list. Disabled until both settings are supplied; see `docs/MARKIPLIER_EASTER_EGG.md`.
