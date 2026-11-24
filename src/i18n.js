import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDirectory = resolve(here, '..', 'lang');
const localeCache = new Map();
const metadataCache = new Map();
const locales = readdirSync(localesDirectory).filter((name) => name.endsWith('.lang')).map((name) => name.slice(0, -5)).sort();

export function availableLocales() {
  return [...locales];
}

export function hasLocale(language) {
  return locales.includes(String(language ?? '').trim().toLowerCase());
}

export function parseLocaleMetadata(source) {
  const languages = [];
  const contributors = [];
  for (const sourceLine of String(source ?? '').split(/\r?\n/)) {
    const match = sourceLine.match(/^\s*#\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (!value) continue;
    if (key === 'language') languages.push(value.slice(0, 80));
    if (key === 'contributor') contributors.push(value.slice(0, 80));
  }
  return {
    language: languages[0] ?? null,
    languageCount: languages.length,
    contributors: [...new Set(contributors)],
  };
}

export function localeMetadata(language) {
  const normalized = normalizeLocaleCode(language);
  if (metadataCache.has(normalized)) return metadataCache.get(normalized);
  const filePath = resolve(localesDirectory, normalized + '.lang');
  const metadata = parseLocaleMetadata(readFileSync(filePath, 'utf8'));
  metadataCache.set(normalized, metadata);
  return metadata;
}

function decodeValue(value) {
  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === 'n') { result += '\n'; i += 1; continue; }
      if (next === '\\') { result += '\\'; i += 1; continue; }
    }
    result += value[i];
  }
  return result;
}

function normalizeLocaleCode(language) {
  return String(language ?? 'ru').toLowerCase().startsWith('en') ? 'en'
    : String(language ?? 'ru').toLowerCase().startsWith('ru') ? 'ru'
      : String(language ?? 'ru').toLowerCase();
}

export function loadLocale(language) {
  const normalized = normalizeLocaleCode(language);
  if (localeCache.has(normalized)) return localeCache.get(normalized);
  const filePath = resolve(localesDirectory, `${normalized}.lang`);
  const dictionary = new Map();
  const text = readFileSync(filePath, 'utf8');
  for (const [index, sourceLine] of text.split(/\r?\n/).entries()) {
    const line = sourceLine.trimEnd();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error(`Invalid translation at ${filePath}:${index + 1}`);
    const key = line.slice(0, separator).trim();
    if (dictionary.has(key)) throw new Error(`Duplicate translation key ${key} at ${filePath}:${index + 1}`);
    dictionary.set(key, decodeValue(line.slice(separator + 1)));
  }
  localeCache.set(normalized, dictionary);
  return dictionary;
}

export function translate(language, key, values = {}) {
  const selected = loadLocale(language);
  const fallback = language === 'ru' ? loadLocale('en') : loadLocale('ru');
  let output = selected.get(key) ?? fallback.get(key) ?? key;
  for (const [name, value] of Object.entries(values)) output = output.replaceAll(`{${name}}`, String(value));
  return output;
}

export function localeEntries(language) {
  return [...loadLocale(language).entries()];
}
