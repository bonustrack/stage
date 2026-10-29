import { getActiveViemAccount } from './accounts';
import { linkProxyBase } from './linkProxy';
import type { X402Accept } from './useLinkPreview';
import { buildAuthorization, buildTypedData, buildPaymentHeader, randomNonce } from '@stage-labs/client/x402/payment';

export interface X402PayResult {
  ok: boolean;
  status: number;
  body?: string;
}

function assertExactChallenge(accept: X402Accept): void {
  if (accept.scheme !== 'exact') throw new Error('Unsupported x402 scheme');
  if (!accept.payTo) throw new Error('Challenge missing payTo');
  if (!accept.amount) throw new Error('Challenge missing amount');
  if (!accept.asset) throw new Error('Challenge missing asset');
}

async function settlePayment(resource: string, paymentHeader: string): Promise<X402PayResult> {
  const res = await fetch(`${linkProxyBase()}/x402-settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-stage-client': '1' },
    body: JSON.stringify({ url: resource, paymentHeader }),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const j = (await res.json()) as { ok?: boolean; status?: number; body?: string };
  return {
    ok: j.ok === true && (j.status == null || j.status === 200),
    status: typeof j.status === 'number' ? j.status : res.status,
    body: typeof j.body === 'string' ? j.body : undefined,
  };
}

export async function payX402Exact({
  resource,
  accept,
  x402Version,
}: {
  resource: string;
  accept: X402Accept;
  x402Version?: number;
}): Promise<X402PayResult> {
  assertExactChallenge(accept);
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to pay with');
  const authorization = buildAuthorization({ from: local.address, accept, now: Math.floor(Date.now() / 1000), nonce: randomNonce() });
  const signature = await local.signTypedData(buildTypedData(accept, authorization));
  return settlePayment(resource, buildPaymentHeader({ accept, authorization, signature, x402Version }));
}
