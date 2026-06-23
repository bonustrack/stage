
import { type Hex } from 'viem';
import {
  type WalletSendCallsContent, normalizeWalletSendCalls, chainIdToNumber,
} from '@stage-labs/client/xmtp/tx';
import { publicClientFor } from '@stage-labs/client/wallet/client';
import { SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { getActiveAccount, smartOwnerSigner } from './accounts';

const SMART_ONLY = 'This account cannot fulfill transaction requests yet. Switch to a smart account to continue.';
const WRONG_CHAIN = 'This transaction is for another network. Smart accounts can only execute on Base.';

interface KernelCall { to: Hex; value: bigint; data?: Hex }

async function sendBatchSmart(active: AccountRecord, calls: KernelCall[]): Promise<Hex> {
  if (active.hdIndex == null) throw new Error('Smart account is missing its key index.');
  const { makePublicClient, makeKernelClient } = await import('./zerodev');
  const { createEcdsaKernel } = await import('@stage-labs/client/zerodev/account');
  const owner = smartOwnerSigner(active.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, active.hdIndex);
  const kernel = makeKernelClient(account, publicClient);
  const encoded = await account.encodeCalls(calls);
  return kernel.sendTransaction({
    to: account.address, value: 0n, data: encoded,
  } as Parameters<typeof kernel.sendTransaction>[0]);
}

export interface ExecuteTxResult {
  txHash: Hex;
  chainId: number;
}

export async function executeTxRequest(content: WalletSendCallsContent): Promise<ExecuteTxResult> {
  const { chainId, calls } = normalizeWalletSendCalls(content);
  const active = await getActiveAccount();
  if (active?.type !== 'smart') throw new Error(SMART_ONLY);
  if (chainId !== SCW_CHAIN_ID) throw new Error(WRONG_CHAIN);
  const txHash = await sendBatchSmart(active, calls);
  await publicClientFor(SCW_CHAIN_ID).waitForTransactionReceipt({ hash: txHash });
  return { txHash, chainId };
}

export function txRequestChainId(content: WalletSendCallsContent): number {
  return chainIdToNumber(content.chainId);
}
