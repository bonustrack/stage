/** Server-side x402 settlement replay for the link-preview Worker.
 *
 *  The x402 app worker (which owns X402Card.tsx + lib/x402.ts) builds a signed
 *  `X-PAYMENT` header client-side, then needs the resource re-fetched WITH that
 *  header so the upstream verifies + settles the payment and returns the paid
 *  content. It can't do that fetch from the device behind our IP-privacy posture,
 *  so it POSTs here and we replay the GET at the edge behind the same SSRF guards.
 *
 *  POST /x402-settle  { url, paymentHeader }  ->  { status, ok, body? }
 *
 *  We only forward the single `X-PAYMENT` header (plus our UA); no device headers
 *  leak upstream. The response body is trimmed to a small cap so a hostile/large
 *  upstream can't be used to exfiltrate or amplify. SSRF guards + manual redirect
 *  revalidation mirror fetchPage/fetchImage. */

import { assertPublicUrl, SsrfError } from './ssrf.ts';

const TIMEOUT_MS = 8000; // settlement (on-chain verify) can be slower than a page fetch
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 16_000; // trimmed echo of the paid response, not the full asset
const UA = 'Mozilla/5.0 (compatible; MetroLinkPreview/1.0; +https://metro.box)';

export interface SettleRequest {
  url: string;
  paymentHeader: string;
}

export interface SettleResult {
  status: number;
  ok: boolean;
  body?: string;
}

/** Validate a parsed POST body is a usable settle request. */
export function parseSettleBody(body: unknown): SettleRequest | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  const paymentHeader = typeof o.paymentHeader === 'string' ? o.paymentHeader.trim() : '';
  if (!url || !paymentHeader) return null;
  return { url, paymentHeader };
}

/** Read a response body trimmed to MAX_BODY_BYTES, decoded as UTF-8. */
async function readTrimmed(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, MAX_BODY_BYTES);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= MAX_BODY_BYTES) { void reader.cancel(); break; }
    }
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return new TextDecoder('utf-8').decode(out).slice(0, MAX_BODY_BYTES);
}

/** Replay a GET to `url` with the caller's `X-PAYMENT` header, behind the SSRF
 *  guards (re-validated on every redirect hop). Throws {@link SsrfError} on an
 *  unsafe URL/redirect. Returns the upstream status + a trimmed body echo. */
export async function settleX402(req: SettleRequest): Promise<SettleResult> {
  let current = assertPublicUrl(req.url).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': UA,
        'X-PAYMENT': req.paymentHeader,
        Accept: 'application/json,text/html,*/*;q=0.5',
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { status: res.status, ok: false };
      current = assertPublicUrl(new URL(loc, current).toString()).toString();
      continue;
    }
    const body = await readTrimmed(res);
    return { status: res.status, ok: res.ok, body: body || undefined };
  }
  throw new SsrfError('too many redirects');
}
