
import {
  isAddress, erc20Abi, encodeFunctionData,
  createWalletClient, type Hex,
} from 'viem';
import { getActiveViemAccount } from './accounts';
import { VIEM_CHAINS } from '../components/tabs/WalletScreen.assets';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { parseAmount } from './txAmount';

const rpcTransport = broviderTransport;

interface SendToken {
  address: Hex;
  decimals?: number;
  symbol?: string;
}

export interface SendParams {
  to: string;
  amount: string;
  token?: SendToken;
  chainId?: number;
}

export async function sendNativeOrToken(params: SendParams): Promise<Hex> {
  const { to, amount, token, chainId = 1 } = params;

  if (!isAddress(to)) throw new Error('Invalid recipient address');
  const value = parseAmount(amount, token ? token.decimals ?? 18 : 18);

  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to send from');
  const chain = VIEM_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  const client = createWalletClient({ account: local, chain, transport: rpcTransport(chainId) });
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

export interface RawCall {
  to: string;
  data?: string;
  value?: string;
  chainId?: number;
}

export async function sendCall(call: RawCall): Promise<Hex> {
  const { to, data, chainId = 1 } = call;
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  const value = BigInt(call.value ?? '0x0');

  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to send from');
  const chain = VIEM_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  const client = createWalletClient({ account: local, chain, transport: rpcTransport(chainId) });
  return client.sendTransaction({
    chain, to: to, value, ...(data ? { data: data as Hex } : {}),
  });
}
