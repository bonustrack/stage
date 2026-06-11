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

async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const res = await fetch(`${LINK_PREVIEW_BASE}/preview?url=${encodeURIComponent(url)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<LinkPreview> & { error?: string };
    if (j.error) return null;
    // A card needs at least a title or an image to be worth rendering.
    if (!j.title && !j.image) return null;
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

export function useLinkPreview(url: string | null): LinkPreview | null {
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
