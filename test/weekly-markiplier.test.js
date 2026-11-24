import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkiplierClipUrls,
  rollWeeklyMarkiplierClip,
  WEEKLY_MARKIPLIER_CLIP_CHANCE,
} from '../src/weekly-markiplier.js';

test('uses a rare but plausible one-in-one-hundred weekly chance', () => {
  assert.equal(WEEKLY_MARKIPLIER_CLIP_CHANCE, 0.01);
});

test('parses HTTPS clip URLs, trims them and removes duplicates', () => {
  assert.deepEqual(parseMarkiplierClipUrls(
    ' https://youtu.be/one , http://example.com/nope;https://youtu.be/two\nhttps://youtu.be/one '
  ), [
    'https://youtu.be/one',
    'https://youtu.be/two',
  ]);
});

test('ignores malformed, non-HTTPS and credential-bearing URLs', () => {
  assert.deepEqual(parseMarkiplierClipUrls('not a URL, http://example.com, https://user:pass@example.com'), []);
});

test('does not roll or select when no valid clips are configured', () => {
  let calls = 0;
  assert.equal(rollWeeklyMarkiplierClip([], () => { calls += 1; return 0; }), null);
  assert.equal(calls, 0);
});

test('a failed weekly roll returns null without choosing a clip', () => {
  let calls = 0;
  assert.equal(rollWeeklyMarkiplierClip(['one', 'two'], () => { calls += 1; return 0.01; }), null);
  assert.equal(calls, 1);
});

test('a successful weekly roll selects one item from the curated list', () => {
  const values = [0.009, 0.75];
  let index = 0;
  assert.equal(rollWeeklyMarkiplierClip(['one', 'two', 'three', 'four'], () => values[index++]), 'four');
  assert.equal(index, 2);
});

test('rejects a broken injected random source', () => {
  assert.throws(() => rollWeeklyMarkiplierClip(['one'], () => 1), RangeError);
});
