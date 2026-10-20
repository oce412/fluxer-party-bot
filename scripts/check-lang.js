import { readFileSync } from 'node:fs';
import { availableLocales, localeEntries } from '../src/i18n.js';

const languages = availableLocales();
const errors = [];
if (!languages.includes('ru')) errors.push('lang/ru.lang must be present as the Russian fallback.');
if (!languages.includes('en')) errors.push('lang/en.lang must be present as the English fallback.');
const dictionaries = new Map(languages.map((language) => [language, new Map(localeEntries(language))]));
const baseLanguage = languages.includes('en') ? 'en' : languages[0];
const base = dictionaries.get(baseLanguage) ?? new Map();

for (const language of languages) {
  const dictionary = dictionaries.get(language);
  for (const key of [...new Set([...base.keys(), ...dictionary.keys()])].sort()) {
    if (!dictionary.has(key)) errors.push(`Missing in ${language}.lang: ${key}`);
    if (!base.has(key)) errors.push(`Extra in ${language}.lang (not in ${baseLanguage}.lang): ${key}`);
    if (!dictionary.has(key) || !base.has(key)) continue;
    const placeholders = (value) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort().join(',');
    if (placeholders(dictionary.get(key)) !== placeholders(base.get(key))) {
      errors.push(`Placeholder mismatch for ${key}: ${language}={${placeholders(dictionary.get(key))}} ${baseLanguage}={${placeholders(base.get(key))}}`);
    }
  }
}

const source = readFileSync(new URL('../bot.js', import.meta.url), 'utf8');
const usedKeys = new Set([...source.matchAll(/\bt\(['"]([^'"]+)['"]/g)].map((match) => match[1]));
for (const key of [...usedKeys].sort()) {
  for (const language of languages) {
    if (!dictionaries.get(language).has(key)) errors.push(`bot.js uses missing translation key: ${key} (${language}.lang)`);
  }
}
// These keys are referenced indirectly through data-driven property names or `translateText(language, key)`.
const indirectKeys = new Set(['reminder24', 'reminder1', 'reminder5', 'languageName']);
for (const key of [...base.keys()].sort()) {
  if (!usedKeys.has(key) && !indirectKeys.has(key)) errors.push(`Unused translation key (remove it or use it): ${key}`);
}

if (errors.length) {
  console.error(`Language check failed (${errors.length} issue(s)):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Language check passed: ${languages.join(', ')}; ${base.size} matching keys; placeholders and code references are valid.`);
