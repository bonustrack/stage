/** @file Shared x402 (HTTP 402 Payment Required) payment-challenge wire format and parser — pure TypeScript, the single source of truth imported by both proxy and app so the format can't fork; accepts v1 (`maxAmountRequired`) and v2 (`amount`/`accepted`) bodies, normalising to { scheme, network, asset?, amount?, payTo?, description?, maxTimeoutSeconds?, extra? }. */

/** A normalised single payment option from an x402 challenge: `amount` is the required amount in the asset's atomic units as a decimal string (verbatim from the server), and `network` is the server's network id (CAIP-2 like `eip155:8453` or a legacy name like `base`). */
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

/** Collect the raw accept options from an x402 body: the `accepts` array, or a single inlined `accepted` option (v2), or null when neither is present. */
function rawAcceptsOf(o: Record<string, unknown>): RawAccept[] | null {
  if (Array.isArray(o.accepts)) return o.accepts as RawAccept[];
  /** Some single-option servers inline the option (v2 `accepted`). */
  if (o.accepted && typeof o.accepted === 'object') return [o.accepted];
  return null;
}

/** Normalise one raw accept option. Returns null when it lacks a usable scheme + network (the minimum to be actionable). */
export function normaliseAccept(a: RawAccept): X402Accept | null {
  const scheme = str(a.scheme);
  const network = str(a.network);
  if (!scheme || !network) return null;
  /** v1 calls the amount `maxAmountRequired`; v2 calls it `amount`. Both atomic. */
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

/** Parses a decoded x402 challenge object (JSON body, decoded `PAYMENT-REQUIRED` header, or the proxy's envelope) into a normalised challenge, returning null if it isn't one; `endpoint` is the fallback recorded when the object doesn't carry its own. */
export function parseX402Challenge(
  obj: unknown,
  endpoint: string,
): X402Challenge | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const rawAccepts = rawAcceptsOf(o);
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
