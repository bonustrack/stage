
import { fetchPublic, readCappedText, UA } from './ssrf.ts';

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 16_000;

interface SettleRequest {
  url: string;
  paymentHeader: string;
}

interface SettleResult {
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

function paymentHeaders(req: SettleRequest): (url: string) => Record<string, string> {
  let initialOrigin: string | null = null;
  let sendPaymentHeader = true;
  return (url) => {
    const origin = new URL(url).origin;
    initialOrigin ??= origin;
    if (origin !== initialOrigin) sendPaymentHeader = false;
    const headers: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json,text/html,*/*;q=0.5' };
    if (sendPaymentHeader) headers['X-PAYMENT'] = req.paymentHeader;
    return headers;
  };
}

export async function settleX402(req: SettleRequest): Promise<SettleResult> {
  const { res } = await fetchPublic(req.url, {
    maxRedirects: MAX_REDIRECTS, timeoutMs: TIMEOUT_MS, headers: paymentHeaders(req),
  });
  if (res.status >= 300 && res.status < 400) return { status: res.status, ok: false };
  const body = ((await readCappedText(res, MAX_BODY_BYTES)) ?? '').slice(0, MAX_BODY_BYTES);
  return { status: res.status, ok: res.ok, body: body || undefined };
}
