import { execFileSync } from 'node:child_process';
import packageJson from '../package.json' with { type: 'json' };
import { createServer } from 'node:http';

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  response.end(payload);
}

function normalizeRevision(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.toLowerCase() === 'unknown') return null;
  return normalized.slice(0, 48);
}

function readGitRevision() {
  try {
    const revision = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
      windowsHide: true,
    }).trim();
    if (!/^[a-f0-9]{7,40}$/i.test(revision)) return 'unknown';

    // Mark local edits so /healthz does not imply the running source is an
    // exact match for HEAD when the working tree has uncommitted changes.
    let dirty = false;
    try {
      dirty = Boolean(execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1500,
        windowsHide: true,
      }).trim());
    } catch {
      // The commit SHA is still useful if Git status is unavailable.
    }
    return dirty ? `${revision}-dirty` : revision;
  } catch {
    // Production containers do not include Git. Their Docker build should
    // inject BUILD_REVISION so this fallback is only needed in source checkouts.
    return 'unknown';
  }
}

export function resolveBuildRevision({ revision = process.env.BUILD_REVISION, gitLookup = readGitRevision } = {}) {
  return normalizeRevision(revision) ?? normalizeRevision(gitLookup()) ?? 'unknown';
}

export async function startHealthServer({
  port = null,
  host = '0.0.0.0',
  isReady = async () => false,
  revision,
  gitLookup = readGitRevision,
} = {}) {
  if (port === null || port === undefined || String(port).trim() === '') return null;
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
    throw new Error('HEALTH_PORT/PORT must be an integer from 0 to 65535.');
  }
  // Port 0 asks the operating system for an ephemeral port (useful in tests).
  // Omit HEALTH_PORT/PORT entirely to disable the server.

  const buildRevision = resolveBuildRevision({ revision, gitLookup });

  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.method !== 'GET' || !['/healthz', '/readyz'].includes(pathname)) {
      sendJson(response, 404, { status: 'not_found' });
      return;
    }
    if (pathname === '/healthz') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'fluxer-party-events-bot',
        version: packageJson.version,
        revision: buildRevision,
      });
      return;
    }
    try {
      const ready = await isReady();
      sendJson(response, ready ? 200 : 503, {
        status: ready ? 'ready' : 'not_ready',
        version: packageJson.version,
        revision: buildRevision,
      });
    } catch {
      sendJson(response, 503, { status: 'not_ready' });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(parsedPort, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return {
    port: typeof address === 'object' && address ? address.port : parsedPort,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
