import test from 'node:test';
import assert from 'node:assert/strict';
import { availableLocales, hasLocale, localeMetadata, parseLocaleMetadata } from '../src/i18n.js';

test('parses a display name and multiple opt-in contributors from locale comments', () => {
  assert.deepEqual(parseLocaleMetadata([
    '# English translations',
    '# Language: English',
    '# Contributor: Alice',
    '# Contributor: Bob Example',
    '# Values support \\n line breaks.',
    'languageName=This is not metadata',
  ].join('\n')), {
    language: 'English',
    languageCount: 1,
    contributors: ['Alice', 'Bob Example'],
  });
});

test('ignores ordinary comments and empty metadata values', () => {
  assert.deepEqual(parseLocaleMetadata([
    '# translator notes',
    '# Language:',
    '# Contributor:  ',
    '# keep translations intact',
  ].join('\n')), {
    language: null,
    languageCount: 0,
    contributors: [],
  });
});

test('repository locales expose opt-in credits from their own files', () => {
  for (const code of availableLocales()) {
    const metadata = localeMetadata(code);
    assert.equal(typeof metadata.language, 'string');
    assert.ok(metadata.language.length > 0);
    assert.equal(metadata.languageCount, 1);
    assert.ok(Array.isArray(metadata.contributors));
  }
  assert.ok(localeMetadata('en').contributors.includes('oce412'));
  assert.ok(localeMetadata('ru').contributors.includes('oce412'));
});

test('locale membership checks recognize installed languages and reject unknown codes', () => {
  for (const code of availableLocales()) assert.equal(hasLocale(code), true);
  assert.equal(hasLocale('xx-invalid'), false);
  assert.equal(hasLocale(''), false);
});
