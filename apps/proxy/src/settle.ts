
import { assertPublicUrl, readCappedText, SsrfError } from './ssrf.ts';

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 16_000;
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

export function parseSettleBody(body: unknown): SettleRequest | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  const paymentHeader = typeof o.paymentHeader === 'string' ? o.paymentHeader.trim() : '';
  if (!url || !paymentHeader) return null;
  return { url, paymentHeader };
}

export async function settleX402(req: SettleRequest): Promise<SettleResult> {
  let current = assertPublicUrl(req.url).toString();
  const initialOrigin = new URL(current).origin;
  let sendPaymentHeader = true;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers: Record<string, string> = {
      'User-Agent': UA,
      Accept: 'application/json,text/html,*/*;q=0.5',
    };
    if (sendPaymentHeader) headers['X-PAYMENT'] = req.paymentHeader;
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { status: res.status, ok: false };
      current = assertPublicUrl(new URL(loc, current).toString()).toString();
      if (new URL(current).origin !== initialOrigin) sendPaymentHeader = false;
      continue;
    }
    const body = ((await readCappedText(res, MAX_BODY_BYTES)) ?? '').slice(0, MAX_BODY_BYTES);
    return { status: res.status, ok: res.ok, body: body || undefined };
  }
  throw new SsrfError('too many redirects');
}
