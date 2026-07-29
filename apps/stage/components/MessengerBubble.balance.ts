import { useQuery } from '@tanstack/react-query';
import { formatUnits, isAddress, erc20Abi, type Hex } from 'viem';

import { getActiveAccount } from '../lib/accounts';
import { ASSETS, NATIVE_TOKEN_SENTINEL } from '../components/tabs/WalletScreen.assets';
import { chainFor, publicClientFor } from '@stage-labs/client/wallet/client';
import { chainIdToNumber } from '@stage-labs/client/xmtp/tx';

export interface PayerBalance {
  text: string;
  insufficient: boolean;
}

function parseChainId(raw?: string | number): number {
  return raw == null || raw === '' ? 1 : chainIdToNumber(raw);
}

function trim(value: string): string {
  if (!value.includes('.')) return value;
  const [whole, frac] = value.split('.');
  const cut = (frac ?? '').slice(0, 4).replace(/0+$/, '');
  return cut ? `${whole ?? ''}.${cut}` : (whole ?? '');
}

function isNativeToken(token?: string): boolean {
  if (!token) return true;
  const t = token.toLowerCase();
  return t === NATIVE_TOKEN_SENTINEL.toLowerCase()
    || t === '0x0000000000000000000000000000000000000000'
    || t === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

interface OnchainMeta {
  raw: bigint;
  decimals: number;
  symbol: string;
}

const minimalErc20Abi = [
  ...erc20Abi.filter(x => x.type === 'function' && (x.name === 'balanceOf' || x.name === 'decimals' || x.name === 'symbol')),
] as const;

async function readOnchain(
  cid: number, token: string | undefined, addr: Hex,
): Promise<OnchainMeta | null> {
  const chain = chainFor(cid);
  const pub = publicClientFor(cid);

  if (isNativeToken(token)) {
    const raw = await pub.getBalance({ address: addr });
    return { raw, decimals: chain.nativeCurrency.decimals, symbol: chain.nativeCurrency.symbol };
  }

  if (token === undefined || !isAddress(token)) return null;
  const t = token;
  const raw = await pub.readContract({
    address: t, abi: erc20Abi, functionName: 'balanceOf', args: [addr],
  });
  let decimals = 18;
  let symbol = 'tokens';
  try {
    decimals = await pub.readContract({ address: t, abi: minimalErc20Abi, functionName: 'decimals' });
  } catch { }
  try {
    symbol = await pub.readContract({ address: t, abi: minimalErc20Abi, functionName: 'symbol' });
  } catch { }
  return { raw, decimals, symbol };
}

function buildBalance(
  onchain: OnchainMeta, native: boolean,
  symbol: string | undefined, needed: number | undefined,
  known: { decimals: number; symbol: string } | undefined,
): PayerBalance {
  const decimals = known?.decimals ?? onchain.decimals;
  const human = formatUnits(onchain.raw, decimals);
  const sym = known?.symbol
    ?? symbol
    ?? (native ? onchain.symbol : (onchain.symbol === 'tokens' ? 'tokens' : onchain.symbol));
  return {
    text: `Balance: ${trim(human)} ${sym}`,
    insufficient: needed != null && Number(human) < needed,
  };
}

async function resolveBalance(
  chainId: string | number | undefined,
  token: string | undefined, symbol: string | undefined, needed?: number,
): Promise<PayerBalance | null> {
  const cid = parseChainId(chainId);
  const acct = await getActiveAccount();
  const addr = acct?.address;
  if (!addr || !isAddress(addr)) return null;
  const known = ASSETS.find(a => a.chainId === cid
    && a.symbol.toLowerCase() === (symbol ?? '').toLowerCase());
  const onchain = await readOnchain(cid, token, addr).catch(() => null);
  if (!onchain) return null;
  return buildBalance(onchain, isNativeToken(token), symbol, needed, known);
}

export function usePayerBalance(
  chainId: string | number | undefined,
  token: string | undefined,
  symbol: string | undefined,
  needed?: number,
): PayerBalance | null {
  const { data } = useQuery({
    queryKey: ['payerBalance', parseChainId(chainId), token ?? '', symbol ?? '', needed ?? -1],
    queryFn: () => resolveBalance(chainId, token, symbol, needed),
  });
  return data ?? null;
}
