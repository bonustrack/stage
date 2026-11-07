import { z } from 'zod';
import { parseX402Challenge, type X402Challenge } from '../x402/challenge';
import { PROXY_ROUTES, STAGE_CLIENT_HEADERS } from '../endpoints';

const previewText = z.string().optional().catch(undefined);

const linkPreviewSchema = z.object({
  url: previewText,
  title: previewText,
  description: previewText,
  image: previewText,
  siteName: previewText,
  favicon: previewText,
  imageOrigin: previewText,
  faviconOrigin: previewText,
});

export type LinkPreview = z.infer<typeof linkPreviewSchema> & { url: string };

export type LinkPreviewResult = LinkPreview | X402Challenge;

export function isX402(r: LinkPreviewResult | null): r is X402Challenge {
  return !!r && 'kind' in r && r.kind === 'x402';
}

function ogPreviewFrom(j: Record<string, unknown>, url: string): LinkPreview | null {
  const parsed = linkPreviewSchema.safeParse(j);
  if (!parsed.success || (parsed.data.title === undefined && parsed.data.image === undefined)) return null;
  return { ...parsed.data, url: parsed.data.url ?? url };
}

function linkPreviewFrom(j: Record<string, unknown>, url: string): LinkPreviewResult | null {
  if (typeof j.error === 'string' && !('accepts' in j)) return null;
  if (j.kind === 'x402') return parseX402Challenge(j, typeof j.endpoint === 'string' ? j.endpoint : '');
  return ogPreviewFrom(j, url);
}

export async function fetchLinkPreview(proxyBase: string, url: string): Promise<LinkPreviewResult | null> {
  try {
    const res = await fetch(`${proxyBase}${PROXY_ROUTES.preview}?url=${encodeURIComponent(url)}`, {
      headers: { Accept: 'application/json', ...STAGE_CLIENT_HEADERS },
    });
    if (!res.ok) return null;
    return linkPreviewFrom((await res.json()) as Record<string, unknown>, url);
  } catch {
    return null;
  }
}
