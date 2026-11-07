import { X402_SETTLE_REQUEST, type X402SettleRequest, type X402SettleResult } from '@stage-labs/client/x402/settle';
import { fetchPublic, readCappedText, UA } from './ssrf.ts';

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 16_000;

export function parseSettleBody(body: unknown): X402SettleRequest | null {
  const parsed = X402_SETTLE_REQUEST.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function paymentHeaders(req: X402SettleRequest): (url: string) => Record<string, string> {
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

export async function settleX402(req: X402SettleRequest): Promise<X402SettleResult> {
  const { res } = await fetchPublic(req.url, { maxRedirects: MAX_REDIRECTS, timeoutMs: TIMEOUT_MS, headers: paymentHeaders(req) });
  if (res.status >= 300 && res.status < 400) return { status: res.status, ok: false };
  const body = ((await readCappedText(res, MAX_BODY_BYTES)) ?? '').slice(0, MAX_BODY_BYTES);
  return { status: res.status, ok: res.ok, body: body || undefined };
}
