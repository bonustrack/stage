import { getActiveViemAccount } from './accounts';
import { linkProxyBase } from './linkProxy';
import type { X402Accept } from '@stage-labs/client/x402';
import { buildAuthorization, buildTypedData, buildPaymentHeader, randomNonce } from '@stage-labs/client/x402/payment';
import { readSettleReply, type X402SettleRequest, type X402SettleResult } from '@stage-labs/client/x402/settle';
import { PROXY_ROUTES, STAGE_CLIENT_HEADERS } from '@stage-labs/client/endpoints';
import { fetchWithin } from '@stage-labs/client/timing';

const SETTLE_TIMEOUT_MS = 30_000;

function assertExactChallenge(accept: X402Accept): void {
  if (accept.scheme !== 'exact') throw new Error('Unsupported x402 scheme');
  if (!accept.payTo) throw new Error('Challenge missing payTo');
  if (!accept.amount) throw new Error('Challenge missing amount');
  if (!accept.asset) throw new Error('Challenge missing asset');
}

async function settledResult(res: Response): Promise<X402SettleResult> {
  if (!res.ok) return { ok: false, status: res.status };
  const settled = readSettleReply(await res.json());
  return { ok: settled.ok && settled.status === 200, status: settled.status, body: settled.body };
}

function settlePayment(resource: string, paymentHeader: string): Promise<X402SettleResult> {
  const request: X402SettleRequest = { url: resource, paymentHeader };
  return fetchWithin(
    `${linkProxyBase()}${PROXY_ROUTES.settle}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...STAGE_CLIENT_HEADERS },
      body: JSON.stringify(request),
    },
    { timeoutMs: SETTLE_TIMEOUT_MS },
    settledResult,
  );
}

export async function payX402Exact({
  resource,
  accept,
  x402Version,
}: {
  resource: string;
  accept: X402Accept;
  x402Version?: number;
}): Promise<X402SettleResult> {
  assertExactChallenge(accept);
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to pay with');
  const authorization = buildAuthorization({ from: local.address, accept, now: Math.floor(Date.now() / 1000), nonce: randomNonce() });
  const signature = await local.signTypedData(buildTypedData(accept, authorization));
  return settlePayment(resource, buildPaymentHeader({ accept, authorization, signature, x402Version }));
}
