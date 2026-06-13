/** ZeroDev viem clients for the smart account: a Base public client, the
 *  ZeroDev paymaster client, and a Kernel account client wired to sponsor every
 *  userOp. Thin IO over the SDK — protocol constants come from
 *  @stage-labs/client/zerodev/config; the RPC URL from ./env.
 *
 *  Lazy-deploy: the Kernel is counterfactual until the first sponsored userOp,
 *  which deploys it inside that op (paid by the paymaster). Until then
 *  `account.address` is the stable, deterministic wallet identity. */

import '../cryptoShim';
import { http, createPublicClient, type PublicClient } from 'viem';
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
  return createPublicClient({ chain: base, transport: http(rpc) });
}

/** A Kernel account client that sponsors every userOp through the ZeroDev
 *  paymaster and prices gas via the bundler. `account` comes from ./account
 *  (createKernelAccount). The returned client deploys the Kernel lazily on the
 *  first `sendUserOperation`. */
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
