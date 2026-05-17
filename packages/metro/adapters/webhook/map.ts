/**
 * Webhook adapter — project an inbound HTTP request into the universal envelope.
 * `raw.payload` = `{ endpointId, label, method, url, headers, body }`. Hot-reloaded on save.
 */

export function map(raw, _metro) {
  if (raw.station !== 'webhook') return null;
  const p = raw.payload;
  const event = p.headers?.['x-github-event'] ?? p.headers?.['x-intercom-topic'] ?? 'event';
  const id = p.headers?.['x-github-delivery'] ?? p.headers?.['x-request-id'] ?? crypto.randomUUID();
  const line = `metro://webhook/${p.endpointId}`;
  return {
    line,
    lineName: p.label,
    from: line,
    messageId: id,
    text: `${event} ${p.method} ${p.url}`,
  };
}
