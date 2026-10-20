# Production container for Fluxer Party Events Bot.
# Build with the verified package-lock.json present in the project root.
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=data-production

WORKDIR /app

# Exact dependency tree from package-lock.json; installs runtime dependencies only.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Copy runtime-only files, not docs, tests, source control metadata or Compose files.
COPY --chown=node:node bot.js ./bot.js
COPY --chown=node:node src ./src
COPY --chown=node:node lang ./lang
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts/run-migrations.js ./scripts/run-migrations.js
COPY --chown=node:node scripts/container-entrypoint.sh ./scripts/container-entrypoint.sh
RUN mkdir -p /app/data-production \
    && chown node:node /app/data-production

USER node
EXPOSE 3000

# Readiness includes gateway + storage health. Docker marks the container healthy
# only once the bot has connected to Fluxer and its database is queryable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "const port = Number(process.env.HEALTH_PORT || process.env.PORT || 3000); fetch('http://127.0.0.1:' + port + '/readyz', { signal: AbortSignal.timeout(4000) }).then((r) => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["sh", "/app/scripts/container-entrypoint.sh"]
