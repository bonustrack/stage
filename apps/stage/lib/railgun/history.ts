import { formatUnits } from 'viem';
import { stampTokenUrl } from '@stage-labs/kit/avatar';
import { isBridgeAvailable, engineInit, walletInfo } from './bridge';
import { sdk } from './bridge/sdk';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { RAILGUN_NETWORKS, type RailgunNet } from './networks';
import { RAILGUN_TOKENS, type TokenMeta } from './tokens';

type PrivateActivityKind = 'shield' | 'unshield' | 'transfer';

export interface PrivateActivityRow {
  key: string;
  kind: PrivateActivityKind;
  direction: 'in' | 'out';
  symbol: string;
  logoUrl: string;
  amount: string;
  chainId: number;
  chainLabel: string;
  timestamp: number;
  txid: string;
}

interface HistoryErc20Amount {
  tokenAddress: string;
  amount: string;
  shieldFee?: string | null;
}
interface HistoryItem {
  txid: string;
  timestamp?: number | null;
  category?: string;
  receiveERC20Amounts?: HistoryErc20Amount[];
  transferERC20Amounts?: HistoryErc20Amount[];
  unshieldERC20Amounts?: HistoryErc20Amount[];
}

function tokenForAddress(net: RailgunNet, address: string): TokenMeta | undefined {
  const want = address.toLowerCase();
  return RAILGUN_TOKENS[net].find((t) => t.address.toLowerCase() === want);
}

function shortToken(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function isShieldReceive(item: HistoryItem, leg: HistoryErc20Amount): boolean {
  if (leg.shieldFee !== undefined && leg.shieldFee !== null) return true;
  return item.category === 'ShieldERC20s';
}

function rowsForItem(net: RailgunNet, item: HistoryItem): PrivateActivityRow[] {
  const cfg = RAILGUN_NETWORKS[net];
  const ts = typeof item.timestamp === 'number' ? item.timestamp : 0;
  const map = (
    a: HistoryErc20Amount,
    kind: PrivateActivityKind,
    direction: 'in' | 'out',
  ): PrivateActivityRow => {
    const meta = tokenForAddress(net, a.tokenAddress);
    let amount = a.amount;
    try { amount = formatUnits(BigInt(a.amount), meta?.decimals ?? 18); } catch { }
    return {
      key: `${item.txid}-${kind}-${direction}-${a.tokenAddress}`,
      kind,
      direction,
      symbol: meta?.symbol ?? shortToken(a.tokenAddress),
      logoUrl: meta ? stampTokenUrl(meta.logoChainId, meta.logoAddress, 32) : '',
      amount,
      chainId: cfg.chainId,
      chainLabel: cfg.label,
      timestamp: ts,
      txid: item.txid,
    };
  };
  return [
    ...(item.receiveERC20Amounts ?? []).map((a) =>
      map(a, isShieldReceive(item, a) ? 'shield' : 'transfer', 'in')),
    ...(item.unshieldERC20Amounts ?? []).map((a) => map(a, 'unshield', 'out')),
    ...(item.transferERC20Amounts ?? []).map((a) => map(a, 'transfer', 'out')),
  ];
}

async function historyForNet(net: RailgunNet, walletID: string): Promise<PrivateActivityRow[]> {
  const cfg = RAILGUN_NETWORKS[net];
  try {
    const items = await sdk<HistoryItem[]>('wallet.getTransactionHistory', [
      { type: 0, id: cfg.chainId },
      walletID,
      undefined,
    ]);
    return (items ?? []).flatMap((it) => rowsForItem(net, it));
  } catch {
    return [];
  }
}

export interface PrivateActivityResult {
  available: boolean;
  rows: PrivateActivityRow[];
}

export async function fetchPrivateActivity(): Promise<PrivateActivityResult> {
  if (!isBridgeAvailable()) return { available: false, rows: [] };
  const key = await deriveRailgunKeyMaterial();
  try { await engineInit(); } catch { }
  const info = await walletInfo({
    encryptionKey: key.encryptionKey,
    mnemonic: key.mnemonic,
    creationBlocks: key.creationBlocks,
  });
  const nets = Object.keys(RAILGUN_NETWORKS) as RailgunNet[];
  const perNet = await Promise.all(nets.map((n) => historyForNet(n, info.railgunWalletID)));
  const rows = perNet.flat().sort((a, b) => b.timestamp - a.timestamp);
  return { available: true, rows };
}
