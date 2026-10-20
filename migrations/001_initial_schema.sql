CREATE TABLE IF NOT EXISTS party_events (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  series_id TEXT,
  series_index INTEGER,
  status TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  channel_id TEXT,
  message_id TEXT,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS party_events_guild_status_start_idx
  ON party_events (guild_id, status, starts_at);
CREATE INDEX IF NOT EXISTS party_events_series_idx
  ON party_events (series_id, series_index);
CREATE INDEX IF NOT EXISTS party_events_channel_message_idx
  ON party_events (channel_id, message_id);
CREATE TABLE IF NOT EXISTS party_guild_settings (
  guild_id TEXT PRIMARY KEY,
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS party_user_settings (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  time_zone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, user_id)
);
