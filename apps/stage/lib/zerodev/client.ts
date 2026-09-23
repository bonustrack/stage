
import '../cryptoShim';
import { http, createPublicClient, type Chain, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import {
  createKernelAccountClient, createZeroDevPaymasterClient, getUserOperationGasPrice,
  type KernelAccountClient,
} from '@zerodev/sdk';
import type { KernelSmartAccountImplementation } from '@zerodev/sdk';
import type { KernelValidator } from '@zerodev/sdk/types';
import type { SmartAccount } from 'viem/account-abstraction';
import { zerodevRpcUrl } from './env';

export function makePublicClient(): PublicClient {
  const rpc = zerodevRpcUrl();
  if (!rpc) throw new Error('ZeroDev project not configured (EXPO_PUBLIC_ZERODEV_PROJECT_ID).');
  const chain: Chain = base;
  return createPublicClient({ chain, transport: http(rpc) });
}


export function makeKernelClient(
  account: SmartAccount<KernelSmartAccountImplementation>,
  publicClient: PublicClient,
): KernelAccountClient {
  const rpc = zerodevRpcUrl();
  if (!rpc) throw new Error('ZeroDev project not configured (EXPO_PUBLIC_ZERODEV_PROJECT_ID).');
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

export type SudoSwapResult =
  | { ok: true; txHash: string }
  | { ok: false; message: string };

export async function swapSudoValidator(
  kernelClient: KernelAccountClient, sudoValidator: KernelValidator,
): Promise<{ hash: string; success: boolean }> {
  const hash = await kernelClient.changeSudoValidator({ sudoValidator });
  const receipt = await kernelClient.waitForUserOperationReceipt({ hash, timeout: 120_000 });
  return { hash, success: receipt.success };
}
