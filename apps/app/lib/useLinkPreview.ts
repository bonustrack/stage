/**
 * @file TanStack Query hook fetching OpenGraph-ish metadata for a plain http(s) link via the Metro link-preview proxy (which handles the server-side fetch/parse + SSRF guarding).
 *  Results are hard-cached keyed on the url, and any failure resolves to null so the caller renders no card rather than a broken one.
 */

import { useQuery } from '@tanstack/react-query';
import { parseX402Challenge, type X402Accept, type X402Challenge } from '@stage-labs/client/x402';

// Re-export the shared wire-format types so existing `./useLinkPreview` imports
// keep working; the single source of truth lives in @stage-labs/client/x402.
export type { X402Accept, X402Challenge };

/** Base url of the link-preview proxy. Overridable via env so a dev build can point at a local instance; defaults to the production tunnel host. */
const LINK_PREVIEW_BASE_ENV: unknown = process.env.EXPO_PUBLIC_LINKPROXY_URL;
export const LINK_PREVIEW_BASE =
  typeof LINK_PREVIEW_BASE_ENV === 'string' && LINK_PREVIEW_BASE_ENV !== ''
    ? LINK_PREVIEW_BASE_ENV.replace(/\/$/, '')
    : 'https://preview.metro.box';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  /** Original (un-proxied) image/favicon URLs, kept for debugging / fallback. The app renders `image`/`favicon` (Worker /img proxy URLs), never these. */
  imageOrigin?: string;
  faviconOrigin?: string;
}

/** The proxy returns either an OpenGraph preview or an x402 payment challenge. */
export type LinkPreviewResult = LinkPreview | X402Challenge;

/** True when a proxy result is an x402 payment challenge (vs an OG preview). */
export function isX402(r: LinkPreviewResult | null): r is X402Challenge {
  return !!r && 'kind' in r && r.kind === 'x402';
}

/** Get the Link Preview. */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor to satisfy function-size limits
async function fetchLinkPreview(url: string): Promise<LinkPreviewResult | null> {
  try {
    const res = await fetch(`${LINK_PREVIEW_BASE}/preview?url=${encodeURIComponent(url)}`, {
      // x-stage-client: abuse speed-bump on /preview; the Worker rejects /preview
      // without it. /img does NOT require it - RN <Image> GETs can't send custom
      // headers, so proxied image/favicon loads are header-free (see apps/proxy).
      headers: { Accept: 'application/json', 'x-stage-client': '1' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (typeof j.error === 'string' && !('accepts' in j)) return null;
    // x402 payment challenge takes precedence over an OG card.
    if (j.kind === 'x402') return parseX402Challenge(j, typeof j.endpoint === 'string' ? j.endpoint : '');
    // A preview card needs at least a title or an image to be worth rendering.
    if (typeof j.title !== 'string' && typeof j.image !== 'string') return null;
    return {
      url: typeof j.url === 'string' ? j.url : url,
      title: typeof j.title === 'string' ? j.title : undefined,
      description: typeof j.description === 'string' ? j.description : undefined,
      image: typeof j.image === 'string' ? j.image : undefined,
      siteName: typeof j.siteName === 'string' ? j.siteName : undefined,
      favicon: typeof j.favicon === 'string' ? j.favicon : undefined,
      imageOrigin: typeof j.imageOrigin === 'string' ? j.imageOrigin : undefined,
      faviconOrigin: typeof j.faviconOrigin === 'string' ? j.faviconOrigin : undefined,
    };
  } catch {
    return null; // proxy unreachable / network — graceful no-op
  }
}

/** Fetch + cache OpenGraph link preview metadata for a URL, or null while idle/unavailable. */
export function useLinkPreview(url: string | null): LinkPreviewResult | null {
  const { data } = useQuery({
    queryKey: ['linkPreview', url ?? ''],
    queryFn: () => fetchLinkPreview(url ?? ''),
    enabled: !!url,
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return data ?? null;
}
