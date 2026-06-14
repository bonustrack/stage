/** x402 `exact` (EIP-3009 / USDC) pay helper — the wallet + network half.
 *
 *  An x402 `exact` challenge is NOT an on-chain transaction: the payer signs an
 *  EIP-3009 `transferWithAuthorization` authorization (a gasless USDC transfer
 *  permit) with their wallet's EIP-712 signer, base64-encodes it into an
 *  `X-PAYMENT` header, and the resource server's facilitator verifies + settles
 *  it on-chain. No gas, no broadcast from the app.
 *
 *  Flow (coinbase/x402 spec, June 2026):
 *    1. Build EIP-3009 typed data from the challenge (lib/x402.payHeader).
 *    2. Sign it via the in-app wallet (the same local-EOA path useTxSignLayer
 *       uses; WalletConnect accounts delegate to wagmi).
 *    3. Encode the X-PAYMENT header (lib/x402.payHeader).
 *    4. POST it to the link-proxy `/x402-settle` endpoint, which replays the GET
 *       to the resource with the header server-side; HTTP 200 == paid.
 *
 *  The pure builders (deterministic, unit-tested) live in lib/x402.payHeader; this
 *  module owns the wallet resolution, signing, nonce/now, and the settle call. */

import { getActiveViemAccount } from './accounts';
import { LINK_PREVIEW_BASE } from './useLinkPreview';
import type { X402Accept } from './useLinkPreview';
import { buildAuthorization, buildTypedData, buildPaymentHeader, randomNonce } from './x402.payHeader';

export interface X402PayResult {
  ok: boolean;
  status: number;
  body?: string;
}

/** Sign an x402 `exact` challenge with the active wallet and settle it through
 *  the link-proxy. Returns the settle result ({ok,status,body}); `ok` true (and
 *  status 200) means the resource accepted the payment.
 *
 *  Only `scheme === 'exact'` is supported; callers gate on that + network/asset
 *  support before invoking. Throws on no wallet / sign failure / network error. */
export async function payX402Exact(args: {
  resource: string;
  accept: X402Accept;
  x402Version?: number;
}): Promise<X402PayResult> {
  const { accept, resource } = args;
  if (accept.scheme !== 'exact') throw new Error('Unsupported x402 scheme');
  if (!accept.payTo) throw new Error('Challenge missing payTo');
  if (!accept.amount) throw new Error('Challenge missing amount');
  if (!accept.asset) throw new Error('Challenge missing asset');

  // Sign with the active account's in-app local key (legacy EOA records).
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
    // The settle endpoint itself errored (4xx/5xx from the proxy, not the
    // resource). Surface its status so the UI can show a real failure.
    return { ok: false, status: res.status };
  }
  const j = (await res.json()) as { ok?: boolean; status?: number; body?: string };
  return {
    ok: j.ok === true && (j.status == null || j.status === 200),
    status: typeof j.status === 'number' ? j.status : res.status,
    body: typeof j.body === 'string' ? j.body : undefined,
  };
}
