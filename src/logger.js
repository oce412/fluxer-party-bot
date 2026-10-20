const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = String(process.env.LOG_LEVEL ?? 'info').toLowerCase();
const minimumLevel = LEVELS[configuredLevel] ?? LEVELS.info;
const SECRET_KEY = /(token|password|secret|authorization|database.?url|connection.?string|client.?secret)/i;

function safeValue(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.map((item) => safeValue(item));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = safeValue(childValue, childKey);
    }
    return output;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') {
    // Avoid accidentally printing embedded bot-token formats in an error string.
    return value
      .replace(/\b\d{15,25}\.[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]')
      .replace(/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s/]+/gi, 'postgresql://[REDACTED]@');
  }
  return value;
}

function write(level, message, fields = {}) {
  if (LEVELS[level] < minimumLevel) return;
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'fluxer-party-events-bot',
    environment: process.env.APP_ENV ?? 'development',
    message: safeValue(String(message ?? ''), 'message'),
    ...safeValue(fields),
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

export const log = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
};

/** Compatibility bridge for existing console-style calls; emits JSON lines. */
export function logConsoleStyle(level, ...args) {
  const message = typeof args[0] === 'string' ? args.shift() : 'Application log';
  const fields = {};
  const extras = args.map((value) => safeValue(value));
  if (extras.length) fields.details = extras;
  write(level, message, fields);
}
