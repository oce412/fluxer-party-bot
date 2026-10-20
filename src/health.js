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

export async function startHealthServer({ port = null, host = '0.0.0.0', isReady = async () => false } = {}) {
  if (port === null || port === undefined || String(port).trim() === '') return null;
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
    throw new Error('HEALTH_PORT/PORT must be an integer from 0 to 65535.');
  }
  // Port 0 asks the operating system for an ephemeral port (useful in tests).
  // Omit HEALTH_PORT/PORT entirely to disable the server.

  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.method !== 'GET' || !['/healthz', '/readyz'].includes(pathname)) {
      sendJson(response, 404, { status: 'not_found' });
      return;
    }
    if (pathname === '/healthz') {
      sendJson(response, 200, { status: 'ok', service: 'fluxer-party-events-bot' });
      return;
    }
    try {
      const ready = await isReady();
      sendJson(response, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready' });
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
