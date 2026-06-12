/** x402 payment-challenge detection for the link-preview proxy.
 *
 *  x402 (coinbase/x402) reactivates HTTP 402 Payment Required: a server that
 *  wants payment for a resource answers with `402` and a machine-readable
 *  payment challenge. The proxy probes a URL and, when it gets a 402 challenge,
 *  surfaces it to the app so the chat can render an x402 payment card instead of
 *  (or alongside) an OpenGraph preview.
 *
 *  Wire formats we accept (verified against coinbase/x402 specs, June 2026):
 *
 *   - LEGACY / v1 body:  HTTP 402 with a JSON body
 *       { x402Version, error?, accepts: [ PaymentRequirements ] }
 *     where each PaymentRequirements has
 *       { scheme, network, maxAmountRequired, resource, description?, mimeType?,
 *         payTo, maxTimeoutSeconds?, asset, extra?: { name?, version? } }
 *     (`maxAmountRequired` is the amount in the asset's atomic units, as a string).
 *
 *   - v2 header:  HTTP 402 with a `PAYMENT-REQUIRED` header carrying a
 *     base64-encoded `PaymentRequired` JSON object of the same shape, whose
 *     per-option amount field is named `amount` (also atomic units).
 *
 *  We normalise both into a single `{ scheme, network, asset, amount, payTo,
 *  description? }` accept entry list, plus the raw decoded challenge for the
 *  app / debugging. Parsing only — no signing, no settlement, no network here. */

/** A normalised single payment option from an x402 challenge. `amount` is the
 *  required amount in the asset's atomic (smallest) units, as a decimal string,
 *  exactly as the server stated it. `network` is the server's network id
 *  (CAIP-2 like `eip155:8453`, or a legacy name like `base`). */
export interface X402Accept {
  scheme: string;
  network: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  description?: string;
  maxTimeoutSeconds?: number;
  /** EIP-712 domain hints for EVM exact (USDC -> { name:'USDC', version:'2' }). */
  extra?: Record<string, unknown>;
}

/** The proxy's x402 result for a URL: the probed endpoint, the normalised
 *  accepted payment options, the x402 protocol version, and the raw challenge. */
export interface X402Challenge {
  kind: 'x402';
  endpoint: string;
  x402Version?: number;
  error?: string;
  accepts: X402Accept[];
  raw: unknown;
}

interface RawAccept {
  scheme?: unknown;
  network?: unknown;
  asset?: unknown;
  amount?: unknown;
  maxAmountRequired?: unknown;
  payTo?: unknown;
  description?: unknown;
  maxTimeoutSeconds?: unknown;
  extra?: unknown;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function normaliseAccept(a: RawAccept): X402Accept | null {
  const scheme = str(a.scheme);
  const network = str(a.network);
  // A usable option needs at least a scheme + network; the rest is best-effort.
  if (!scheme || !network) return null;
  // v1 calls the amount `maxAmountRequired`; v2 calls it `amount`. Both atomic.
  const amount = str(a.amount) ?? str(a.maxAmountRequired);
  return {
    scheme,
    network,
    asset: str(a.asset),
    amount,
    payTo: str(a.payTo),
    description: str(a.description),
    maxTimeoutSeconds:
      typeof a.maxTimeoutSeconds === 'number' ? a.maxTimeoutSeconds : undefined,
    extra:
      a.extra && typeof a.extra === 'object'
        ? (a.extra as Record<string, unknown>)
        : undefined,
  };
}

/** Parse a decoded x402 challenge object (the JSON body, or the decoded
 *  `PAYMENT-REQUIRED` header) into a normalised list of accepts + metadata.
 *  Returns null if it doesn't look like an x402 challenge. Exported for tests. */
export function parseX402Challenge(
  obj: unknown,
  endpoint: string,
): X402Challenge | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const rawAccepts = Array.isArray(o.accepts)
    ? (o.accepts as RawAccept[])
    : // Some single-option servers inline the option (v2 `accepted`).
      o.accepted && typeof o.accepted === 'object'
      ? [o.accepted as RawAccept]
      : null;
  if (!rawAccepts || rawAccepts.length === 0) return null;

  const accepts = rawAccepts
    .map(normaliseAccept)
    .filter((a): a is X402Accept => a !== null);
  if (accepts.length === 0) return null;

  return {
    kind: 'x402',
    endpoint,
    x402Version:
      typeof o.x402Version === 'number' ? o.x402Version : undefined,
    error: str(o.error),
    accepts,
    raw: obj,
  };
}

/** Decode a base64 `PAYMENT-REQUIRED` header value into a challenge object.
 *  Returns null on bad base64 / bad JSON. */
function decodeHeaderChallenge(headerVal: string): unknown {
  try {
    // Workers runtime: use atob (no Node Buffer). base64 -> bytes -> UTF-8 so
    // multi-byte challenge text survives.
    const bin = atob(headerVal.trim());
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Given a 402 response's headers + JSON body (already parsed, or null), build a
 *  normalised challenge. Prefers the body `accepts` (legacy/most common), falls
 *  back to the v2 `PAYMENT-REQUIRED` header. Returns null if neither parses. */
export function challengeFrom402(
  endpoint: string,
  headers: { get(name: string): string | null },
  body: unknown,
): X402Challenge | null {
  const fromBody = parseX402Challenge(body, endpoint);
  if (fromBody) return fromBody;
  const hdr = headers.get('payment-required');
  if (hdr) {
    const decoded = decodeHeaderChallenge(hdr);
    const fromHeader = parseX402Challenge(decoded, endpoint);
    if (fromHeader) return fromHeader;
  }
  return null;
}
