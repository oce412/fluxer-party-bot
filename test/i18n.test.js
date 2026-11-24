import test from 'node:test';
import assert from 'node:assert/strict';
import { availableLocales, hasLocale, loadLocale } from '../src/i18n.js';

test('locale membership checks recognize every installed locale and reject unknown codes', () => {
  const locales = availableLocales();
  assert.ok(locales.includes('en'));
  assert.ok(locales.includes('ru'));
  for (const language of locales) assert.equal(hasLocale(language), true);
  assert.equal(hasLocale('xx-invalid'), false);
  assert.equal(hasLocale(''), false);
});

test('translation dictionaries remain lazily loadable by the selected locale', () => {
  const english = loadLocale('en');
  assert.equal(english.has('help'), true);
  assert.equal(english.has('unknownCommand'), true);
});
