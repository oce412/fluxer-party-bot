# Internal privacy publication checklist

The current user-facing privacy notice is published in the repository root:

**[PRIVACY.md — Juke Privacy Notice](../PRIVACY.md)**

Use that file as the source for public links. Do not link this internal checklist from the bot listing.

## Items to confirm before describing the notice as a final GDPR policy

- Confirm the controller's full legal identity and the contact details that should be made public. The project currently identifies its maintainer by the public handle oce412 and provides partybotfluxer@gmail.com as its privacy contact.
- Determine and document the Article 6 GDPR legal basis for each processing purpose. Do not assume consent simply because a member uses a command or RSVPs; assess the actual relationship and purposes.
- Confirm whether a data-protection officer or EU representative is required for the operator's circumstances.
- Identify the competent supervisory authority based on the controller's establishment and applicable law.
- Check whether any additional Article 13/14 disclosures are required for data obtained from Fluxer events rather than directly from the member.
- Keep the statements about FluxerHost EU infrastructure, backup snapshots, and log retention aligned with the host's current service arrangement and policy.
- If the optional Google Forms integrations are enabled, update the public notice before collecting form submissions.

## Current implementation facts

- Routine server command replies stay in the channel by default.
- The administrator's multi-step !event setup wizard runs in DMs and asks whether the community should enable DM controls.
- Private DM controls are disabled by default and can be changed with !event setup dm on|off.
- Event, RSVP, community setting, notification and member time-zone records have no automatic age expiry while the bot remains installed.
- On Fluxer's permanent GuildDelete event, the bot removes the affected community's events, RSVPs, notification records, settings and member time-zone preferences from the active database.
- That application cleanup does not delete Fluxer messages or FluxerHost-managed backups and hosting logs.
- The bot application and persistent PostgreSQL container use FluxerHost's EU infrastructure.
- Privacy requests are handled at partybotfluxer@gmail.com.

This checklist is internal project documentation, not legal advice. See the [official GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), especially Articles 6, 13, 14 and 17.
