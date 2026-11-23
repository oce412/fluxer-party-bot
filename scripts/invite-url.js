import { buildBotInviteUrl, getInvitePermissionBits } from '../src/invite-permissions.js';

const applicationId = String(process.env.FLUXER_APPLICATION_ID ?? '').trim();
if (!/^\d{15,25}$/.test(applicationId)) {
  console.error('Set FLUXER_APPLICATION_ID to your public bot application ID first.');
  process.exit(1);
}

const invite = (permissions) => buildBotInviteUrl(applicationId, permissions);
const minimum = getInvitePermissionBits();
const recommended = getInvitePermissionBits({ manageMessages: true });

console.log('Minimum (includes Embed Links; command self-deletion remains disabled):');
console.log(invite(minimum));
console.log('\nRecommended (Manage Messages enables optional command self-deletion):');
console.log(invite(recommended));
console.log('\nNo Administrator permission is requested. Existing installations may need to be re-authorized to grant Embed Links.');
