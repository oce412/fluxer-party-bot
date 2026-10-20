-- Keep recurring-series lifecycle queries selective as the event table grows.
CREATE INDEX IF NOT EXISTS party_events_guild_series_status_idx
  ON party_events (guild_id, series_id, status)
  WHERE series_id IS NOT NULL;
