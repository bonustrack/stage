
import {
  isAddress, erc20Abi, encodeFunctionData,
  createWalletClient, type Account, type Chain, type Hex, type Transport, type WalletClient,
} from 'viem';
import { getActiveViemAccount } from './accounts';
import { VIEM_CHAINS } from '@stage-labs/client/wallet/assets';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { parseSendAmount } from '@stage-labs/client/wallet/send';


interface SendToken {
  address: Hex;
  decimals?: number;
  symbol?: string;
}

interface SendParams {
  to: string;
  amount: string;
  token?: SendToken;
  chainId?: number;
}

async function walletClientFor(chainId: number): Promise<{ client: WalletClient<Transport, Chain, Account>; chain: Chain }> {
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to send from');
  const chain = VIEM_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  return { client: createWalletClient({ account: local, chain, transport: broviderTransport(chainId) }), chain };
}

export async function sendNativeOrToken(params: SendParams): Promise<Hex> {
  const { to, amount, token, chainId = 1 } = params;

  if (!isAddress(to)) throw new Error('Invalid recipient address');
  const value = parseSendAmount(amount, token ? token.decimals ?? 18 : 18);

  const { client, chain } = await walletClientFor(chainId);
  if (token) {
    return client.sendTransaction({
      chain,
      to: token.address,
      data: encodeFunctionData({
        abi: erc20Abi, functionName: 'transfer', args: [to, value],
      }),
    });
  }
  return client.sendTransaction({ chain, to: to, value });
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
