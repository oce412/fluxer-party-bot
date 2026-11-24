# Optional Markiplier clip Easter egg

This feature is deliberately separate from event announcements. It is disabled unless both environment variables below are configured:

- `MARKIPLIER_CLIP_CHANNEL_ID`: the ID of one text channel where the bot may post.
- `MARKIPLIER_CLIP_URLS`: a comma-, semicolon-, or newline-separated list of HTTPS clip URLs.

The bot makes **one 1-in-100 roll per UTC ISO week**, on its first healthy scheduler pass in that week. If the roll succeeds, it chooses one URL uniformly from the configured list and posts it to the configured channel. It does not DM users or broadcast to every community.

A 1-in-100 weekly chance has about a 41% chance of producing at least one clip over 52 weeks; the expected wait is 100 weeks (about 1.9 years). This is intended to be rare without being practically impossible.

The roll week is stored in the destination community's existing settings, so restarts do not create extra attempts. If a clip is selected but sending fails, the selected URL is persisted and retried on later scheduler passes. A failed weekly roll is also persisted, so it is not rerolled until the next ISO week.

The bot needs permission to send messages in the configured channel. Keep the list curated and use public HTTPS links that are appropriate for the community. Leaving either environment variable empty disables the feature.
