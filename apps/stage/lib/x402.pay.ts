
import { getActiveViemAccount } from './accounts';
import { LINK_PREVIEW_BASE } from './useLinkPreview';
import type { X402Accept } from './useLinkPreview';
import { buildAuthorization, buildTypedData, buildPaymentHeader, randomNonce } from './x402.payHeader';

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
    return { ok: false, status: res.status };
  }
  const j = (await res.json()) as { ok?: boolean; status?: number; body?: string };
  return {
    ok: j.ok === true && (j.status == null || j.status === 200),
    status: typeof j.status === 'number' ? j.status : res.status,
    body: typeof j.body === 'string' ? j.body : undefined,
  };
}

export async function payX402Exact(args: {
  resource: string;
  accept: X402Accept;
  x402Version?: number;
}): Promise<X402PayResult> {
  const { accept, resource } = args;
  assertExactChallenge(accept);

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
