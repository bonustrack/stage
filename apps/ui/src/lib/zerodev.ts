// Build cache-bust: rebuild preview to bake VITE_ZERODEV_PROJECT_ID (2026-06-23).
import { http, createPublicClient, type Chain, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import {
  createKernelAccountClient, createZeroDevPaymasterClient, getUserOperationGasPrice,
  type KernelAccountClient, type KernelSmartAccountImplementation,
} from '@zerodev/sdk';
import type { SmartAccount } from 'viem/account-abstraction';
import { SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';

const PROJECT_ID = (import.meta.env.VITE_ZERODEV_PROJECT_ID as string | undefined) ?? '';

function zerodevRpcUrl(): string | null {
  const override = (import.meta.env.VITE_ZERODEV_RPC as string | undefined)?.trim();
  if (override) return override;
  if (!PROJECT_ID) return null;
  return `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/${SCW_CHAIN_ID}`;
}

const ZERODEV_UNCONFIGURED = 'Smart accounts are unavailable (ZeroDev is not configured).';

function requireRpc(): string {
  const rpc = zerodevRpcUrl();
  if (!rpc) throw new Error(ZERODEV_UNCONFIGURED);
  return rpc;
}

export function makePublicClient(): PublicClient {
  const rpc = requireRpc();
  const chain: Chain = base;
  return createPublicClient({ chain, transport: http(rpc) });
}

export function makeKernelClient(
  account: SmartAccount<KernelSmartAccountImplementation>,
  publicClient: PublicClient,
): KernelAccountClient {
  const rpc = requireRpc();
  const paymasterClient = createZeroDevPaymasterClient({ chain: base, transport: http(rpc) });
  return createKernelAccountClient({
    account,
    chain: base,
    bundlerTransport: http(rpc),
    client: publicClient,
    paymaster: {
      getPaymasterData: (userOperation) =>
        paymasterClient.sponsorUserOperation({ userOperation }),
    },
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient),
    },
  });
}
