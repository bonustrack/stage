
export interface X402Accept {
  scheme: string;
  network: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  description?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

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

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function rawAcceptsOf(o: Record<string, unknown>): RawAccept[] | null {
  if (Array.isArray(o.accepts)) return o.accepts as RawAccept[];
  if (o.accepted && typeof o.accepted === 'object') return [o.accepted];
  return null;
}

export function normaliseAccept(a: RawAccept): X402Accept | null {
  const scheme = str(a.scheme);
  const network = str(a.network);
  if (!scheme || !network) return null;
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
