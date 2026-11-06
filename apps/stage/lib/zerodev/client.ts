import '../cryptoShim';
import { http, createPublicClient, type Chain, type Hex, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import { createKernelAccountClient, createZeroDevPaymasterClient, getUserOperationGasPrice } from '@zerodev/sdk';
import type { KernelSmartAccountImplementation } from '@zerodev/sdk';
import type { SmartAccount } from 'viem/account-abstraction';
import { createEcdsaKernel } from '@stage-labs/client/zerodev/account';
import { WALLET_CHAIN_ID } from '@stage-labs/client/wallet/chains';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { smartOwnerSigner } from './keyring';
import { envString } from '../env';

const PROJECT_ID: string = envString(process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID) ?? '';
const RPC_OVERRIDE = envString(process.env.EXPO_PUBLIC_ZERODEV_RPC);

function zerodevRpcUrl(): string | null {
  if (RPC_OVERRIDE) return RPC_OVERRIDE;
  if (!PROJECT_ID) return null;
  return `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/${WALLET_CHAIN_ID}`;
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

function makeKernelClient(account: SmartAccount<KernelSmartAccountImplementation>, publicClient: PublicClient) {
  const rpc = configuredRpcUrl();
  const paymasterClient = createZeroDevPaymasterClient({ chain: base, transport: http(rpc) });
  return createKernelAccountClient({
    account,
    chain: base,
    bundlerTransport: http(rpc),
    client: publicClient,
    paymaster: { getPaymasterData: (userOperation) => paymasterClient.sponsorUserOperation({ userOperation }) },
    userOperation: { estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient) },
  });
}

export type StageKernelClient = ReturnType<typeof makeKernelClient>;

export async function kernelClientForRecord(rec: AccountRecord): Promise<StageKernelClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const publicClient = makePublicClient();
  const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex, rec.address as Hex);
  return makeKernelClient(account, publicClient);
}
