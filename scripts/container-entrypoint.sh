#!/bin/sh
set -eu

if [ "${APP_ENV:-}" != "production" ]; then
  echo "Refusing container startup: APP_ENV must be production." >&2
  exit 1
fi
if [ -z "${FLUXER_BOT_TOKEN:-}" ]; then
  echo "Refusing container startup: FLUXER_BOT_TOKEN must be provided as a runtime secret." >&2
  exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Refusing container startup: DATABASE_URL must be provided as a runtime secret." >&2
  exit 1
fi

printf '%s\n' '{"level":"info","service":"fluxer-party-events-bot","message":"Applying database migrations before container startup"}'
node /app/scripts/run-migrations.js

# exec makes Node the container's main process so SIGTERM/SIGINT are handled cleanly.
exec node /app/bot.js
