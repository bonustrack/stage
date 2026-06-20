
import { useQuery } from '@tanstack/react-query';
import { parseX402Challenge, type X402Accept, type X402Challenge } from '@stage-labs/client/x402';

export type { X402Accept, X402Challenge };

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
  imageOrigin?: string;
  faviconOrigin?: string;
}

export type LinkPreviewResult = LinkPreview | X402Challenge;

export function isX402(r: LinkPreviewResult | null): r is X402Challenge {
  return !!r && 'kind' in r && r.kind === 'x402';
}

function str(j: Record<string, unknown>, key: string): string | undefined {
  const v = j[key];
  return typeof v === 'string' ? v : undefined;
}

function ogPreviewFrom(j: Record<string, unknown>, url: string): LinkPreview | null {
  if (typeof j.title !== 'string' && typeof j.image !== 'string') return null;
  return {
    url: str(j, 'url') ?? url,
    title: str(j, 'title'),
    description: str(j, 'description'),
    image: str(j, 'image'),
    siteName: str(j, 'siteName'),
    favicon: str(j, 'favicon'),
    imageOrigin: str(j, 'imageOrigin'),
    faviconOrigin: str(j, 'faviconOrigin'),
  };
}

function linkPreviewFrom(j: Record<string, unknown>, url: string): LinkPreviewResult | null {
  if (typeof j.error === 'string' && !('accepts' in j)) return null;
  if (j.kind === 'x402') return parseX402Challenge(j, typeof j.endpoint === 'string' ? j.endpoint : '');
  return ogPreviewFrom(j, url);
}

async function fetchLinkPreview(url: string): Promise<LinkPreviewResult | null> {
  try {
    const res = await fetch(`${LINK_PREVIEW_BASE}/preview?url=${encodeURIComponent(url)}`, {
      headers: { Accept: 'application/json', 'x-stage-client': '1' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    return linkPreviewFrom(j, url);
  } catch {
    return null;
  }
}

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
