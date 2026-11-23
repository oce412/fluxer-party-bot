import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  isSupportedTimeZone,
  normalizeFixedOffsetTimeZone,
  normalizeLocalDateTimeInput,
  resolveDurationMinutes,
} from '../src/time-input.js';

test('accepts one- and two-digit 24-hour clock hours', () => {
  assert.equal(normalizeLocalDateTimeInput('2026-12-05 1:00'), '2026-12-05 01:00');
  assert.equal(normalizeLocalDateTimeInput('2026-12-05 01:00'), '2026-12-05 01:00');
  assert.equal(normalizeLocalDateTimeInput('2026-12-05 23:59'), '2026-12-05 23:59');
});

test('rejects invalid clock values and malformed date-time shapes', () => {
  assert.equal(normalizeLocalDateTimeInput('2026-12-05 24:00'), null);
  assert.equal(normalizeLocalDateTimeInput('2026-12-05 12:60'), null);
  assert.equal(normalizeLocalDateTimeInput('2026-12-05 1:2'), null);
  assert.equal(normalizeLocalDateTimeInput('05-12-2026 1:00'), null);
});

test('normalizes UTC and GMT offset variants', () => {
  assert.equal(normalizeFixedOffsetTimeZone('utc'), 'UTC');
  assert.equal(normalizeFixedOffsetTimeZone('GMT'), 'UTC');
  assert.equal(normalizeFixedOffsetTimeZone('gmt+2'), 'UTC+2');
  assert.equal(normalizeFixedOffsetTimeZone('GMT+02:00'), 'UTC+2');
  assert.equal(normalizeFixedOffsetTimeZone('UTC-05:30'), 'UTC-5:30');
  assert.equal(normalizeFixedOffsetTimeZone('utc + 14:00'), 'UTC+14');
  assert.equal(normalizeFixedOffsetTimeZone('GMT-0530'), 'UTC-5:30');
  assert.equal(normalizeFixedOffsetTimeZone('UTC-00:00'), 'UTC');
});

test('rejects out-of-range and malformed UTC/GMT offsets', () => {
  assert.equal(normalizeFixedOffsetTimeZone('UTC+15'), null);
  assert.equal(normalizeFixedOffsetTimeZone('GMT-14:01'), null);
  assert.equal(normalizeFixedOffsetTimeZone('UTC+2:75'), null);
  assert.equal(normalizeFixedOffsetTimeZone('UTC++2'), null);
});

test('fixed offsets are supported by Luxon and preserve the intended instant', () => {
  const zone = normalizeFixedOffsetTimeZone('GMT+05:30');
  assert.equal(isSupportedTimeZone(zone), true);
  const local = DateTime.fromFormat('2026-12-05 09:00', 'yyyy-MM-dd HH:mm', { zone });
  assert.equal(local.isValid, true);
  assert.equal(local.toUTC().toFormat("yyyy-MM-dd'T'HH:mm"), '2026-12-05T03:30');
});

test('validates IANA zones as well as fixed offsets', () => {
  assert.equal(isSupportedTimeZone('Europe/Amsterdam'), true);
  assert.equal(isSupportedTimeZone('UTC+3'), true);
  assert.equal(isSupportedTimeZone('Europe'), false);
  assert.equal(isSupportedTimeZone('not-a-time-zone'), false);
});

test('uses the server duration for omitted, malformed and out-of-range values', () => {
  assert.deepEqual(resolveDurationMinutes(undefined, 180), { minutes: 180, defaulted: false });
  assert.deepEqual(resolveDurationMinutes('', 180), { minutes: 180, defaulted: false });
  assert.deepEqual(resolveDurationMinutes('not-a-number', 180), { minutes: 180, defaulted: true });
  assert.deepEqual(resolveDurationMinutes('14', 180), { minutes: 180, defaulted: true });
  assert.deepEqual(resolveDurationMinutes('1441', 180), { minutes: 180, defaulted: true });
  assert.deepEqual(resolveDurationMinutes('90', 180), { minutes: 90, defaulted: false });
});
