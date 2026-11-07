import { useQuery } from '@tanstack/react-query';
import { formatUnits, isAddress, erc20Abi, type Hex } from 'viem';
import { isNativeToken } from '@stage-labs/client/wallet/tokens';
import { ASSETS } from '@stage-labs/client/wallet/assets';
import { chainFor, publicClientFor } from '@stage-labs/client/wallet/client';
import { truncateDecimals } from '@stage-labs/client/wallet/format';
import { simulateTx, type SimulateResult } from '@stage-labs/client/wallet/txSimulate';
import { chainIdToNumber } from '@stage-labs/client/xmtp/tx';
import { getActiveAccount } from './accounts';
import { ignored, recover } from './errorPolicy';

export function useTxSimulation(
  to: string | undefined,
  data: string | undefined,
  value: string | undefined,
  chainId: number,
): { result: SimulateResult | null; pending: boolean } {
  const { data: result, isPending } = useQuery({
    queryKey: ['txSimulate', chainId, to ?? '', data ?? '', value ?? ''],
    queryFn: async (): Promise<SimulateResult> => {
      const from = (await getActiveAccount())?.address;
      if (!from) {
        return { success: 'unknown', assetChanges: { in: [], out: [] }, error: 'No active wallet' };
      }
      return simulateTx({ from, to: to ?? '', data, value, chainId });
    },
    enabled: !!to,
    staleTime: 0,
    gcTime: 0,
  });
  return { result: result ?? null, pending: !!to && isPending };
}

export interface PayerBalance {
  text: string;
  insufficient: boolean;
}

const BALANCE_DIGITS = 4;

const UNREADABLE_TOKEN = { decimals: 18, symbol: 'tokens' } as const;

function parseChainId(raw?: string | number): number {
  return raw == null || raw === '' ? 1 : chainIdToNumber(raw);
}

interface OnchainBalance {
  raw: bigint;
  decimals: number;
  symbol: string;
}

async function readOnchain(cid: number, token: string | undefined, addr: Hex): Promise<OnchainBalance | null> {
  const chain = chainFor(cid);
  const pub = publicClientFor(cid);

  if (isNativeToken(token)) {
    const raw = await pub.getBalance({ address: addr });
    return { raw, decimals: chain.nativeCurrency.decimals, symbol: chain.nativeCurrency.symbol };
  }

  if (token === undefined || !isAddress(token)) return null;
  const raw = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [addr] });
  const [decimals, symbol] = await Promise.all([
    pub
      .readContract({ address: token, abi: erc20Abi, functionName: 'decimals' })
      .catch(ignored<number>(UNREADABLE_TOKEN.decimals, 'optional')),
    pub.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }).catch(ignored<string>(UNREADABLE_TOKEN.symbol, 'optional')),
  ]);
  return { raw, decimals, symbol };
}

function buildBalance(
  onchain: OnchainBalance,
  symbol: string | undefined,
  needed: number | undefined,
  known: { decimals: number; symbol: string } | undefined,
): PayerBalance {
  const decimals = known?.decimals ?? onchain.decimals;
  const human = formatUnits(onchain.raw, decimals);
  const sym = known?.symbol ?? symbol ?? onchain.symbol;
  return { text: `Balance: ${truncateDecimals(human, BALANCE_DIGITS)} ${sym}`, insufficient: needed != null && Number(human) < needed };
}

async function resolveBalance(
  chainId: string | number | undefined,
  token: string | undefined,
  symbol: string | undefined,
  needed?: number,
): Promise<PayerBalance | null> {
  const cid = parseChainId(chainId);
  const acct = await getActiveAccount();
  const addr = acct?.address;
  if (!addr || !isAddress(addr)) return null;
  const known = ASSETS.find((a) => a.chainId === cid && a.symbol.toLowerCase() === (symbol ?? '').toLowerCase());
  const onchain = await readOnchain(cid, token, addr).catch(recover('bubble.balance', null));
  if (!onchain) return null;
  return buildBalance(onchain, symbol, needed, known);
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
