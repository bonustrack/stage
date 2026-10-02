
import {
  isAddress, createWalletClient, type Account, type Chain, type Hex, type Transport, type WalletClient,
} from 'viem';
import { getActiveViemAccount } from './accounts';
import { VIEM_CHAINS } from '@stage-labs/client/wallet/assets';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { buildPublicTransfer, type BuildTransferArgs } from '@stage-labs/client/wallet/send';

interface SendParams {
  to: string;
  amount: string;
  asset: BuildTransferArgs['asset'];
  chainId: number;
}

async function walletClientFor(chainId: number): Promise<{ client: WalletClient<Transport, Chain, Account>; chain: Chain }> {
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to send from');
  const chain = VIEM_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  return { client: createWalletClient({ account: local, chain, transport: broviderTransport(chainId) }), chain };
}

export async function sendNativeOrToken({ to, amount, asset, chainId }: SendParams): Promise<Hex> {
  const call = buildPublicTransfer({ recipient: to, amount, asset });
  const { client, chain } = await walletClientFor(chainId);
  return client.sendTransaction({ chain, ...call });
}

interface RawCall {
  to: string;
  data?: string;
  value?: string;
  chainId?: number;
}

export async function sendCall(call: RawCall): Promise<Hex> {
  const { to, data, chainId = 1 } = call;
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  const value = BigInt(call.value ?? '0x0');

  const { client, chain } = await walletClientFor(chainId);
  return client.sendTransaction({
    chain, to: to, value, ...(data ? { data: data as Hex } : {}),
  });
}
