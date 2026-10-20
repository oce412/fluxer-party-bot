import test from 'node:test';
import assert from 'node:assert/strict';
import { log } from '../src/logger.js';

test('structured logger emits JSON and redacts secret fields and connection URLs', () => {
  const originalWrite = process.stdout.write;
  const lines = [];
  process.stdout.write = function capture(chunk) {
    lines.push(String(chunk));
    return true;
  };
  try {
    log.info('test 123456789012345678.abcdEFGHijklMNOPqrstUVWX', {
      token: 'should-not-appear',
      databaseUrl: 'postgresql://someone:topsecret@db.example.test/prod',
      note: 'postgresql://someone:topsecret@db.example.test/prod',
    });
  } finally {
    process.stdout.write = originalWrite;
  }
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.level, 'info');
  assert.match(record.message, /REDACTED_TOKEN/);
  assert.equal(record.token, '[REDACTED]');
  assert.equal(record.databaseUrl, '[REDACTED]');
  assert.doesNotMatch(JSON.stringify(record), /topsecret|should-not-appear/);
});
