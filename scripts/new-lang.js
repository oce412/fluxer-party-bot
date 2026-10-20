import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const code = String(process.argv[2] ?? '').trim().toLowerCase();
if (!/^[a-z]{2,3}$/.test(code)) {
  console.error('Usage: npm run lang:add -- <language-code>   (example: npm run lang:add -- fr)');
  process.exit(1);
}
const target = join('lang', `${code}.lang`);
if (existsSync(target)) {
  console.error(`${target} already exists.`);
  process.exit(1);
}
const english = readFileSync(join('lang', 'en.lang'), 'utf8');
const lines = english.split(/\r?\n/);
const scaffold = [
  `# ${code} translations. This file was scaffolded from English; translate values before public use.`,
  '# Keep every key and every {placeholder} intact. Use \\n to add a line break.',
  ...lines.filter((line) => line && !line.startsWith('#')).map((line) => {
    if (line.startsWith('languageName=')) return `languageName=${code}`;
    return line;
  }),
];
writeFileSync(target, `${scaffold.join('\n')}\n`, 'utf8');
console.log(`Created ${target} with the English keys. Translate the values, then run npm run check:lang.`);
