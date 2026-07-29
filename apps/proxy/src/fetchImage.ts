
import { assertPublicUrl, readCappedBytes, SsrfError } from './ssrf.ts';

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
export const MAX_IMG_BYTES = 3_000_000;
const DEFAULT_WIDTH = 600;
const MAX_WIDTH = 2000;
const QUALITY = 80;
const UA = 'Mozilla/5.0 (compatible; MetroLinkPreview/1.0; +https://metro.box)';

export interface ImageResult {
  body: ArrayBuffer;
  contentType: string;
  resized: boolean;
}

export function parseWidth(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, MAX_WIDTH);
}

const REQ_HEADERS = {
  'User-Agent': UA,
  Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
};

async function fetchFollowing(
  startUrl: string,
  cf?: RequestInit['cf'],
): Promise<{ res: Response; finalUrl: string }> {
  let current = assertPublicUrl(startUrl).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: REQ_HEADERS,
      ...(cf ? { cf } : {}),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, finalUrl: current };
      current = assertPublicUrl(new URL(loc, current).toString()).toString();
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new SsrfError('too many redirects');
}

async function readImageCapped(res: Response): Promise<ArrayBuffer | null> {
  const declared = Number(res.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_IMG_BYTES) return null;
  const bytes = await readCappedBytes(res, MAX_IMG_BYTES, 'reject');
  return bytes === null ? null : (bytes.buffer as ArrayBuffer);
}

function imageContentType(res: Response): string | null {
  const ct = (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return ct.startsWith('image/') ? ct : null;
}

export async function fetchImage(rawUrl: string, width?: number): Promise<ImageResult | null> {
  const w = width ?? DEFAULT_WIDTH;

  try {
    const { res } = await fetchFollowing(rawUrl, {
      image: { width: w, fit: 'scale-down', quality: QUALITY, format: 'webp', anim: false },
    });
    if (res.ok) {
      const ct = imageContentType(res);
      if (ct) {
        const body = await readImageCapped(res);
        if (body) {
          const resized = res.headers.has('cf-resized');
          return { body, contentType: ct, resized };
        }
      }
    }
  } catch (e) {
    if (e instanceof SsrfError) throw e;
  }

  const { res } = await fetchFollowing(rawUrl);
  if (!res.ok) return null;
  const ct = imageContentType(res);
  if (!ct) return null;
  const body = await readImageCapped(res);
  if (!body) return null;
  return { body, contentType: ct, resized: false };
}
