/** @file ZeroDev viem clients for the smart account (Base public client, paymaster client, and a Kernel account client that sponsors every userOp); thin IO over the SDK that lazily deploys the counterfactual Kernel inside the first sponsored userOp. */

import '../cryptoShim';
import { http, createPublicClient, type Chain, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import {
  createKernelAccountClient, createZeroDevPaymasterClient, getUserOperationGasPrice,
  type KernelAccountClient,
} from '@zerodev/sdk';
import type { KernelSmartAccountImplementation } from '@zerodev/sdk';
import type { SmartAccount } from 'viem/account-abstraction';
import { zerodevRpcUrl } from './env';

/** A Base public client over the ZeroDev RPC. Throws if no project configured. */
export function makePublicClient(): PublicClient {
  const rpc = zerodevRpcUrl();
  if (!rpc) throw new Error('ZeroDev project not configured (EXPO_PUBLIC_ZERODEV_PROJECT_ID).');
  /** `base` is an OP-stack chain whose formatters make viem infer a chain-specific client type; widen to plain `Chain` so the result matches the declared `PublicClient` return (avoids a spurious cross-viem-copy TS2719 under turbo). */
  const chain: Chain = base;
  return createPublicClient({ chain, transport: http(rpc) });
}

/** Whether a Kernel address has on-chain bytecode (deployed, not just counterfactual) via a read-only `getCode`, distinguishing a genuinely-installed passkey from the old counterfactual shortcut that needs a deploy-and-swap repair; throws if ZeroDev is not configured. */
export async function kernelDeployedOnChain(address: string): Promise<boolean> {
  const publicClient = makePublicClient();
  const code = await publicClient.getCode({ address: address as `0x${string}` });
  return !!code && code !== '0x';
}

/** A Kernel account client that sponsors every userOp through the ZeroDev paymaster and prices gas via the bundler. `account` comes from ./account (createKernelAccount). The returned client deploys the Kernel lazily on the first `sendUserOperation`. */
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
