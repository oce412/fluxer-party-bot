# Fluxer bot invite permissions

The generated invite asks for the permissions used by event announcements and RSVP reactions. It does not request Administrator.

## Minimum permission set

| Permission | Bit value | Why it is needed |
|---|---:|---|
| View Channel | 1024 | Access the configured announcement channel |
| Send Messages | 2048 | Publish and update event announcements |
| Add Reactions | 64 | Let members RSVP with reactions |
| Read Message History | 65536 | Fetch existing announcement messages for updates |
| Embed Links | 16384 | Publish the rich event announcement embeds |

**Minimum mask: 85056**

The generated recommended invite adds:

| Permission | Bit value | Why it is optional |
|---|---:|---|
| Manage Messages | 8192 | Allows the bot to delete command messages when the user-facing flow supports it |

**Recommended mask: 93248**

## Updating an existing installation

Adding a permission to the invite generator does not automatically change a bot role that was created earlier. Re-authorize the bot using the new invite and grant the Embed Links permission to its bot role in the community.

Until the permission is granted, the bot attempts to publish the familiar plain-text event card when Fluxer rejects an embed for missing permissions. This fallback is intended to preserve event creation, not to replace the richer presentation.

The OAuth2 bot invite uses the `bot` scope and a decimal permission bitfield. Fluxer documents the `EMBED_LINKS` permission as bit 14 and requires it when sending embeds in a guild channel.

- [Fluxer message API](https://docs.fluxer.com/http-api/messages/)
- [Fluxer permissions reference](https://docs.fluxer.com/http-api/permissions/)
- [Fluxer OAuth2 reference](https://docs.fluxer.com/http-api/oauth2/)
