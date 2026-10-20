const applicationId = String(process.env.FLUXER_APPLICATION_ID ?? '').trim();
if (!/^\d{15,25}$/.test(applicationId)) {
  console.error('Set FLUXER_APPLICATION_ID to your public bot application ID first.');
  process.exit(1);
}
const base = 'https://fluxer.app/oauth2/authorize';
const invite = (permissions) => `${base}?client_id=${encodeURIComponent(applicationId)}&scope=bot&permissions=${permissions}`;
// Fluxer permissions documented at the time this template was prepared:
// view channel 1024, send messages 2048, add reactions 64, read history 65536,
// and optional manage messages 8192 (self-delete commands and responses).
const minimum = 1024n + 2048n + 64n + 65536n;
const recommended = minimum + 8192n;
console.log('Minimum (no Manage Messages; setup commands may remain visible):');
console.log(invite(minimum.toString()));
console.log('\nRecommended (Manage Messages enables optional command self-deletion):');
console.log(invite(recommended.toString()));
console.log('\nNo Administrator permission is requested. Recheck against the latest Fluxer permission docs before public launch.');
