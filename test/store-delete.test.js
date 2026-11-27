import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('deleteGuildData removes events, community settings and member time zones for one guild', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fluxer-party-store-'));
  const previousDataDir = process.env.DATA_DIR;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATA_DIR = directory;
  delete process.env.DATABASE_URL;

  try {
    await writeFile(path.join(directory, 'events.json'), JSON.stringify([
      { id: 'EVENT-A', guildId: 'guild-a', title: 'Private event A' },
      { id: 'EVENT-B', guildId: 'guild-b', title: 'Keep event B' },
    ]));
    await writeFile(path.join(directory, 'settings.json'), JSON.stringify({
      guilds: {
        'guild-a': { announcementChannelId: 'channel-a', language: 'en' },
        'guild-b': { announcementChannelId: 'channel-b', language: 'ru' },
      },
      users: {
        'guild-a:user-1': { timeZone: 'Europe/Amsterdam' },
        'guild-a:user-2': { timeZone: 'Europe/Paris' },
        'guild-b:user-3': { timeZone: 'Europe/Berlin' },
      },
    }));

    const store = await import('../src/store.js?store-delete-test');
    await store.initStore();

    const result = await store.deleteGuildData('guild-a');
    assert.deepEqual(result, {
      guildId: 'guild-a',
      removedEventCount: 1,
      removedUserSettingCount: 2,
    });
    assert.deepEqual(store.allEvents().map((event) => event.id), ['EVENT-B']);
    assert.deepEqual(store.getGuildSettings('guild-a'), {});
    assert.equal(store.getGuildSettings('guild-b').language, 'ru');
    assert.equal(store.getUserTimeZone('guild-a', 'user-1'), null);
    assert.equal(store.getUserTimeZone('guild-b', 'user-3'), 'Europe/Berlin');

    const persistedEvents = JSON.parse(await readFile(path.join(directory, 'events.json'), 'utf8'));
    const persistedSettings = JSON.parse(await readFile(path.join(directory, 'settings.json'), 'utf8'));
    assert.deepEqual(persistedEvents.map((event) => event.guildId), ['guild-b']);
    assert.deepEqual(Object.keys(persistedSettings.guilds), ['guild-b']);
    assert.deepEqual(Object.keys(persistedSettings.users), ['guild-b:user-3']);
    await store.closeStore();
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await rm(directory, { recursive: true, force: true });
  }
});
