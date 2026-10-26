import { fetchPublic, readCappedBytes, SsrfError, UA } from './ssrf.ts';

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_IMG_BYTES = 3_000_000;
const DEFAULT_WIDTH = 600;
const MAX_WIDTH = 2000;
const QUALITY = 80;

interface ImageResult {
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

function fetchFollowing(startUrl: string, cf?: RequestInit['cf']): Promise<{ res: Response }> {
  return fetchPublic(startUrl, { maxRedirects: MAX_REDIRECTS, timeoutMs: TIMEOUT_MS, headers: () => REQ_HEADERS, cf });
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

async function imageFrom(res: Response, resized: boolean): Promise<ImageResult | null> {
  const contentType = res.ok ? imageContentType(res) : null;
  const body = contentType === null ? null : await readImageCapped(res);
  return contentType === null || body === null ? null : { body, contentType, resized };
}

export async function fetchImage(rawUrl: string, width = DEFAULT_WIDTH): Promise<ImageResult | null> {
  try {
    const { res } = await fetchFollowing(rawUrl, {
      image: { width, fit: 'scale-down', quality: QUALITY, format: 'webp', anim: false },
    });
    const image = await imageFrom(res, res.headers.has('cf-resized'));
    if (image) return image;
  } catch (e) {
    if (e instanceof SsrfError) throw e;
  }
  const { res } = await fetchFollowing(rawUrl);
  return imageFrom(res, false);
}
