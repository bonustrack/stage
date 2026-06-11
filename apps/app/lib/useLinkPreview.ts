/** TanStack Query hook fetching OpenGraph-ish metadata for a plain http(s) link
 *  via the Metro link-preview proxy (an iframely-style service; see
 *  apps/linkproxy). The proxy does the server-side fetch/parse + SSRF guarding,
 *  so the client just GETs `/preview?url=…` and renders the JSON card.
 *
 *  Results are cached HARD (long staleTime, no background refetch) keyed on the
 *  url. On any failure (proxy unreachable, blocked url, no metadata) the queryFn
 *  returns null and the caller renders NO card — never a broken/empty one. */

import { useQuery } from '@tanstack/react-query';

/** Base url of the link-preview proxy. Overridable via env so a dev build can
 *  point at a local instance; defaults to the production tunnel host. */
export const LINK_PREVIEW_BASE =
  process.env.EXPO_PUBLIC_LINKPROXY_URL?.replace(/\/$/, '') || 'https://preview.metro.box';

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

/** A single normalised payment option from an x402 challenge. `amount` is in the
 *  asset's atomic (smallest) units, as a decimal string. */
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

/** The proxy's x402 result: the URL answered HTTP 402 with a payment challenge. */
export interface X402Challenge {
  kind: 'x402';
  endpoint: string;
  x402Version?: number;
  error?: string;
  accepts: X402Accept[];
  raw?: unknown;
}

/** The proxy returns either an OpenGraph preview or an x402 payment challenge. */
export type LinkPreviewResult = LinkPreview | X402Challenge;

/** True when a proxy result is an x402 payment challenge (vs an OG preview). */
export function isX402(r: LinkPreviewResult | null): r is X402Challenge {
  return !!r && 'kind' in r && r.kind === 'x402';
}

function parseX402(j: Record<string, unknown>): X402Challenge | null {
  const rawAccepts = Array.isArray(j.accepts) ? j.accepts : null;
  if (!rawAccepts || rawAccepts.length === 0) return null;
  const accepts: X402Accept[] = [];
  for (const r of rawAccepts) {
    if (!r || typeof r !== 'object') continue;
    const a = r as Record<string, unknown>;
    if (typeof a.scheme !== 'string' || typeof a.network !== 'string') continue;
    accepts.push({
      scheme: a.scheme,
      network: a.network,
      asset: typeof a.asset === 'string' ? a.asset : undefined,
      amount: typeof a.amount === 'string' ? a.amount : undefined,
      payTo: typeof a.payTo === 'string' ? a.payTo : undefined,
      description: typeof a.description === 'string' ? a.description : undefined,
      maxTimeoutSeconds: typeof a.maxTimeoutSeconds === 'number' ? a.maxTimeoutSeconds : undefined,
      extra: a.extra && typeof a.extra === 'object' ? (a.extra as Record<string, unknown>) : undefined,
    });
  }
  if (accepts.length === 0) return null;
  return {
    kind: 'x402',
    endpoint: typeof j.endpoint === 'string' ? j.endpoint : '',
    x402Version: typeof j.x402Version === 'number' ? j.x402Version : undefined,
    error: typeof j.error === 'string' ? j.error : undefined,
    accepts,
    raw: j.raw,
  };
}

async function fetchLinkPreview(url: string): Promise<LinkPreviewResult | null> {
  try {
    const res = await fetch(`${LINK_PREVIEW_BASE}/preview?url=${encodeURIComponent(url)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (typeof j.error === 'string' && !('accepts' in j)) return null;
    // x402 payment challenge takes precedence over an OG card.
    if (j.kind === 'x402') return parseX402(j);
    // A preview card needs at least a title or an image to be worth rendering.
    if (typeof j.title !== 'string' && typeof j.image !== 'string') return null;
    return {
      url: typeof j.url === 'string' ? j.url : url,
      title: typeof j.title === 'string' ? j.title : undefined,
      description: typeof j.description === 'string' ? j.description : undefined,
      image: typeof j.image === 'string' ? j.image : undefined,
      siteName: typeof j.siteName === 'string' ? j.siteName : undefined,
      favicon: typeof j.favicon === 'string' ? j.favicon : undefined,
    };
  } catch {
    return null; // proxy unreachable / network — graceful no-op
  }
}

export function useLinkPreview(url: string | null): LinkPreviewResult | null {
  const { data } = useQuery({
    queryKey: ['linkPreview', url ?? ''],
    queryFn: () => fetchLinkPreview(url as string),
    enabled: !!url,
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return data ?? null;
}
