/** @file Edge-side image fetcher for the link-preview Worker: SSRF-guarded fetch with optional Cloudflare Image Resizing, credential stripping, and a size cap. */

import { assertPublicUrl, SsrfError } from './ssrf.ts';

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
export const MAX_IMG_BYTES = 3_000_000; /** ~3 MB cap */
const DEFAULT_WIDTH = 600;
const MAX_WIDTH = 2000;
const QUALITY = 80;
const UA = 'Mozilla/5.0 (compatible; MetroLinkPreview/1.0; +https://metro.box)';

export interface ImageResult {
  body: ArrayBuffer;
  contentType: string;
  /** true when the response actually came back resized via CF Image Resizing. */
  resized: boolean;
}

/** Clamp a caller-supplied width to a sane range, or undefined when absent. */
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

/** Follow redirects manually, re-running the SSRF guard on every hop, and return the final safe URL + the terminal Response (not yet body-read). */
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

/** Drain `reader` into a single buffer, returning null once the size cap is exceeded. */
async function drainCapped(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ArrayBuffer | null> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > MAX_IMG_BYTES) { void reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out.buffer;
}

/** Read a response body, enforcing the size cap. Returns null if it exceeds the cap (so the caller can fall back / reject rather than buffer unbounded). */
async function readImageCapped(res: Response): Promise<ArrayBuffer | null> {
  const declared = Number(res.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_IMG_BYTES) return null;
  const reader = res.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  if (!reader) {
    const buf = await res.arrayBuffer();
    return buf.byteLength > MAX_IMG_BYTES ? null : buf;
  }
  return drainCapped(reader);
}

/** Image Content Type. */
function imageContentType(res: Response): string | null {
  const ct = (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return ct.startsWith('image/') ? ct : null;
}

/** Fetch `rawUrl` as an image, optionally resized to `width` px wide. Throws {@link SsrfError} on an unsafe URL/redirect; returns null when the upstream isn't a valid image, errors, or exceeds the size cap. */
export async function fetchImage(rawUrl: string, width?: number): Promise<ImageResult | null> {
  const w = width ?? DEFAULT_WIDTH;

  /** 1) Try Cloudflare Image Resizing; on a plan without it the cf.image directive is a no-op and the original passes through (detected via cf-resized). */
  try {
    const { res } = await fetchFollowing(rawUrl, {
      image: { width: w, fit: 'scale-down', quality: QUALITY },
    });
    if (res.ok) {
      const ct = imageContentType(res);
      if (ct) {
        const body = await readImageCapped(res);
        if (body) {
          /** `cf-resized` is present only when the resizing pipeline actually ran; absent => unsupported plan / no-op. */
          const resized = res.headers.has('cf-resized');
          return { body, contentType: ct, resized };
        }
      }
    }
  } catch (e) {
    if (e instanceof SsrfError) throw e;
    /** fall through to a plain fetch below */
  }

  /** 2) Plain fetch fallback (no resize), still within the size cap + SSRF guard. */
  const { res } = await fetchFollowing(rawUrl);
  if (!res.ok) return null;
  const ct = imageContentType(res);
  if (!ct) return null;
  const body = await readImageCapped(res);
  if (!body) return null;
  return { body, contentType: ct, resized: false };
}
