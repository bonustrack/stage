/** @file x402 `exact` (EIP-3009 / USDC) pay helper — the wallet + network half that resolves the active wallet, signs the gasless transfer authorization, and POSTs the X-PAYMENT header to the link-proxy `/x402-settle` endpoint (pure header/typed-data builders live in lib/x402.payHeader). */

import { getActiveViemAccount } from './accounts';
import { LINK_PREVIEW_BASE } from './useLinkPreview';
import type { X402Accept } from './useLinkPreview';
import { buildAuthorization, buildTypedData, buildPaymentHeader, randomNonce } from './x402.payHeader';

export interface X402PayResult {
  ok: boolean;
  status: number;
  body?: string;
}

/** Throw if an `exact` challenge is missing the fields needed to sign + settle a payment. */
function assertExactChallenge(accept: X402Accept): void {
  if (accept.scheme !== 'exact') throw new Error('Unsupported x402 scheme');
  if (!accept.payTo) throw new Error('Challenge missing payTo');
  if (!accept.amount) throw new Error('Challenge missing amount');
  if (!accept.asset) throw new Error('Challenge missing asset');
}

/** POST the signed X-PAYMENT header to the link-proxy settle endpoint and normalise its result. */
async function settlePayment(resource: string, paymentHeader: string): Promise<X402PayResult> {
  const res = await fetch(`${LINK_PREVIEW_BASE}/x402-settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-stage-client': '1',
    },
    body: JSON.stringify({ url: resource, paymentHeader }),
  });
  if (!res.ok) {
    /** The settle endpoint itself errored (4xx/5xx from the proxy, not the resource); surface its status so the UI can show a real failure. */
    return { ok: false, status: res.status };
  }
  const j = (await res.json()) as { ok?: boolean; status?: number; body?: string };
  return {
    ok: j.ok === true && (j.status == null || j.status === 200),
    status: typeof j.status === 'number' ? j.status : res.status,
    body: typeof j.body === 'string' ? j.body : undefined,
  };
}

/** Sign an x402 `exact` challenge with the active wallet and settle it through the link-proxy (ok+status 200 means accepted); throws on no wallet / sign / network error. */
export async function payX402Exact(args: {
  resource: string;
  accept: X402Accept;
  x402Version?: number;
}): Promise<X402PayResult> {
  const { accept, resource } = args;
  assertExactChallenge(accept);

  /** Sign with the active account's in-app local key (legacy EOA records). */
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to pay with');
  const from = local.address;

  const authorization = buildAuthorization({
    from,
    accept,
    now: Math.floor(Date.now() / 1000),
    nonce: randomNonce(),
  });
  const typedData = buildTypedData(accept, authorization);

  const signature = await local.signTypedData(typedData);

  const paymentHeader = buildPaymentHeader({
    accept,
    authorization,
    signature,
    x402Version: args.x402Version,
  });

  return settlePayment(resource, paymentHeader);
}
