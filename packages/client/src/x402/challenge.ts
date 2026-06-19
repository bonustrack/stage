/**
 * @file Shared x402 (HTTP 402) payment-challenge wire format and parser, the single source of truth across proxy and app.
 */
/**
 * Shared x402 payment-challenge wire format + parser.
 *
 *  x402 (coinbase/x402) reactivates HTTP 402 Payment Required: a server that
 *  wants payment answers `402` with a machine-readable challenge. Both the
 *  link-preview proxy (which probes the URL at the edge) and the app (which
 *  re-validates the proxy's JSON before rendering a payment card) need to agree
 *  on the EXACT same shape + parse rules — historically this type + parser was
 *  declared three times (apps/proxy, apps/app twice) and drifted. This is the
 *  single source of truth; both sides import it so the wire format can't fork.
 *
 *  Pure TypeScript: no viem, no fetch, no framework, no Node/Worker globals.
 *
 *  Wire formats accepted (coinbase/x402 specs, June 2026):
 *   - v1 body:  402 + JSON { x402Version, error?, accepts: [PaymentRequirements] }
 *               where the amount field is `maxAmountRequired` (atomic units).
 *   - v2:       per-option amount field named `amount` (atomic units); a single
 *               inlined option may appear under `accepted`.
 *  Both normalise to { scheme, network, asset?, amount?, payTo?, description?,
 *  maxTimeoutSeconds?, extra? }.
 */

/**
 * A normalised single payment option from an x402 challenge. `amount` is the
 *  required amount in the asset's atomic (smallest) units, as a decimal string,
 *  exactly as the server stated it. `network` is the server's network id
 *  (CAIP-2 like `eip155:8453`, or a legacy name like `base`).
 */
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

/** The proxy's x402 result for a URL: the probed endpoint, the normalised accepted payment options, the x402 protocol version, and the raw challenge. */
export interface X402Challenge {
  kind: 'x402';
  endpoint: string;
  x402Version?: number;
  error?: string;
  accepts: X402Accept[];
  raw?: unknown;
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

/** Str helper. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Normalise one raw accept option. Returns null when it lacks a usable scheme + network (the minimum to be actionable). */
export function normaliseAccept(a: RawAccept): X402Accept | null {
  const scheme = str(a.scheme);
  const network = str(a.network);
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

/**
 * Parse a decoded x402 challenge object (the JSON body, the decoded
 *  `PAYMENT-REQUIRED` header, or the proxy's own JSON envelope) into a
 *  normalised challenge. Returns null if it doesn't look like an x402 challenge.
 *
 *  `endpoint` is the fallback endpoint to record when the object doesn't already
 *  carry one (the proxy's own envelope embeds `endpoint`).
 */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor (complexity 12)
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
    endpoint: str(o.endpoint) ?? endpoint,
    x402Version: typeof o.x402Version === 'number' ? o.x402Version : undefined,
    error: str(o.error),
    accepts,
    raw: 'raw' in o ? o.raw : obj,
  };
}
