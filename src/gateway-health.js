/**
 * Check the gateway readiness using public Fluxer.js 3.x APIs.
 * `sessionReady` records that we observed Ready or Resumed; `client.isReady()`
 * confirms SDK readiness, and fetchStatus() confirms each in-process shard's
 * WebSocket is currently open. Returns false rather than throwing so health
 * endpoints can safely report 503 during startup/disconnects.
 */
export async function isGatewayConnectionHealthy(client, sessionReady) {
  if (!sessionReady || !client || typeof client.isReady !== 'function') return false;

  try {
    if (!client.isReady()) return false;
    if (!client.ws || typeof client.ws.fetchStatus !== 'function') return false;

    const statuses = await client.ws.fetchStatus();
    if (!(statuses instanceof Map) || statuses.size === 0) return false;

    for (const status of statuses.values()) {
      if (status !== 'open') return false;
    }
    return true;
  } catch {
    return false;
  }
}
