import '../cryptoShim';
import { http, createPublicClient, type Chain, type Hex, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import {
  createKernelAccountClient, createZeroDevPaymasterClient, getUserOperationGasPrice,
  type KernelAccountClient,
} from '@zerodev/sdk';
import type { KernelSmartAccountImplementation } from '@zerodev/sdk';
import type { SmartAccount } from 'viem/account-abstraction';
import { createEcdsaKernel } from '@stage-labs/client/zerodev/account';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { envString } from '../env';

const PROJECT_ID: string = envString(process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID) ?? '';
const RPC_OVERRIDE = envString(process.env.EXPO_PUBLIC_ZERODEV_RPC);

function zerodevRpcUrl(): string | null {
  if (RPC_OVERRIDE) return RPC_OVERRIDE;
  if (!PROJECT_ID) return null;
  return `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/8453`;
}

export function zerodevConfigured(): boolean {
  return zerodevRpcUrl() != null;
}

function configuredRpcUrl(): string {
  const rpc = zerodevRpcUrl();
  if (!rpc) throw new Error('ZeroDev project not configured (EXPO_PUBLIC_ZERODEV_PROJECT_ID).');
  return rpc;
}

export function makePublicClient(): PublicClient {
  const rpc = configuredRpcUrl();
  const chain: Chain = base;
  return createPublicClient({ chain, transport: http(rpc) });
}

function makeKernelClient(
  account: SmartAccount<KernelSmartAccountImplementation>,
  publicClient: PublicClient,
): KernelAccountClient {
  const rpc = configuredRpcUrl();
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

export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const publicClient = makePublicClient();
  const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex, rec.address as Hex);
  return makeKernelClient(account, publicClient);
}
