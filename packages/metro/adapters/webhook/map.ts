/**
 * Webhook adapter — projects an inbound HTTP request into the universal envelope.
 *
 * `raw.payload` shape: `{ endpointId, label, method, url, headers, body }`.
 * `body` is parsed JSON when possible, else the raw string. Provider lives in headers like
 * `x-github-event`, `x-intercom-topic`. Edit freely; daemon hot-reloads on save.
 */

export function map(raw, _metro) {
  if (raw.station !== 'webhook') return null;
  const p = raw.payload;
  const event = p.headers?.['x-github-event']
    ?? p.headers?.['x-intercom-topic']
    ?? 'event';
  const id = p.headers?.['x-github-delivery']
    ?? p.headers?.['x-request-id']
    ?? crypto.randomUUID();
  const line = `metro://webhook/${p.endpointId}`;
  return {
    kind: 'inbound',
    line,
    lineName: p.label,
    from: line,
    messageId: id,
    text: `${event} ${p.method} ${p.url}`,
  };
}
