/** Fluxer permission bit values used by the bot's least-privilege invite URL. */
export const FLUXER_INVITE_PERMISSIONS = Object.freeze({
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  READ_MESSAGE_HISTORY: 1n << 16n,
});

export function getInvitePermissionBits({ manageMessages = false } = {}) {
  const required = FLUXER_INVITE_PERMISSIONS.VIEW_CHANNEL
    | FLUXER_INVITE_PERMISSIONS.SEND_MESSAGES
    | FLUXER_INVITE_PERMISSIONS.ADD_REACTIONS
    | FLUXER_INVITE_PERMISSIONS.READ_MESSAGE_HISTORY
    | FLUXER_INVITE_PERMISSIONS.EMBED_LINKS;
  return manageMessages
    ? required | FLUXER_INVITE_PERMISSIONS.MANAGE_MESSAGES
    : required;
}

export function buildBotInviteUrl(applicationId, permissions) {
  const id = String(applicationId ?? '').trim();
  if (!/^\d{15,25}$/.test(id)) {
    throw new TypeError('Application ID must be a 15–25 digit Fluxer application ID.');
  }
  const permissionBits = typeof permissions === 'bigint' ? permissions : BigInt(permissions);
  if (permissionBits < 0n) throw new RangeError('Permission bitfield cannot be negative.');
  const url = new URL('https://fluxer.app/oauth2/authorize');
  url.searchParams.set('client_id', id);
  url.searchParams.set('scope', 'bot');
  url.searchParams.set('permissions', permissionBits.toString());
  return url.toString();
}
