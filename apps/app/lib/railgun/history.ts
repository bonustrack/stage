/** @file Best-effort fetch of private (0zk) RAILGUN fund movements (shields, unshields, 0zk transfers) for the Activity tab via the Node bridge's whitelisted `wallet.getTransactionHistory`; a per-leg shieldFee marker distinguishes shield-in from transfer-in, bigints arrive as decimal strings, and a chain that errors or has no history is skipped. */
import { formatUnits } from 'viem';
import { stampTokenUrl } from '@metro-labs/kit/avatar';
import { isBridgeAvailable, engineInit, walletInfo } from './bridge';
import { sdk } from './bridge/sdk';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { RAILGUN_NETWORKS, type RailgunNet } from './networks';
import { RAILGUN_TOKENS, type TokenMeta } from './tokens';

/** Kind of private fund movement, used to pick the row label + icon. */
type PrivateActivityKind = 'shield' | 'unshield' | 'transfer';

/** One private fund movement, pre-formatted for the Activity row. */
export interface PrivateActivityRow {
  /** Stable key: txid + kind + direction + token (one item can have several). */
  key: string;
  /** Shield (in), unshield (out), or 0zk->0zk transfer (in/out). */
  kind: PrivateActivityKind;
  direction: 'in' | 'out';
  /** Display symbol (ETH / USDC) when known, else a shortened token address. */
  symbol: string;
  /** stamp.fyi token logo URL (same resolver the wallet token rows use); empty string for an unknown token so the avatar renders just its border circle. */
  logoUrl: string;
  /** Decimal-string amount (formatUnits output), e.g. "1.25". */
  amount: string;
  chainId: number;
  chainLabel: string;
  /** Unix seconds; 0 when the engine couldn't resolve the block time. */
  timestamp: number;
  txid: string;
}

/** Minimal slice of the SDK's TransactionHistoryItem we consume. The bridge serializes bigints to decimal strings, so `amount`/`shieldFee` arrive as strings and `category` arrives as its enum string value. */
interface HistoryErc20Amount {
  tokenAddress: string;
  amount: string;
  /** Present (and non-undefined) on a receive leg that is a shield-in. */
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

/** Resolve token meta for a chain by ERC20 address (case-insensitive). */
function tokenForAddress(net: RailgunNet, address: string): TokenMeta | undefined {
  const want = address.toLowerCase();
  return RAILGUN_TOKENS[net].find((t) => t.address.toLowerCase() === want);
}

/** Shorten a raw token address when it isn't one of our known tokens. */
function shortToken(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** A receive leg is a shield-in (vs a 0zk transfer-in) when it carries a shieldFee marker, or when the item category is the shield category. */
function isShieldReceive(item: HistoryItem, leg: HistoryErc20Amount): boolean {
  if (leg.shieldFee !== undefined && leg.shieldFee !== null) return true;
  return item.category === 'ShieldERC20s';
}

/** Flatten one history item's ERC20 legs into private-activity rows (receive→shield-in if shieldFee else transfer-in, unshield→out, transfer→out); change + broadcaster-fee legs are intentionally skipped as accounting artifacts, not user-initiated movements. */
function rowsForItem(net: RailgunNet, item: HistoryItem): PrivateActivityRow[] {
  const cfg = RAILGUN_NETWORKS[net];
  const ts = typeof item.timestamp === 'number' ? item.timestamp : 0;
  /** Map helper. */
  const map = (
    a: HistoryErc20Amount,
    kind: PrivateActivityKind,
    direction: 'in' | 'out',
  ): PrivateActivityRow => {
    const meta = tokenForAddress(net, a.tokenAddress);
    let amount = a.amount;
    try { amount = formatUnits(BigInt(a.amount), meta?.decimals ?? 18); } catch { /* keep raw */ }
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

/** Fetch the private fund-movement history for one network. Best-effort: returns [] on any failure (engine not warm, scan not ready, RPC hiccup). */
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

/** Outcome of a private-activity fetch. `available` is false only when the bridge isn't in this binary (web / non-Railgun build); the caller uses it to decide whether to render the section + its empty state at all. */
export interface PrivateActivityResult {
  available: boolean;
  rows: PrivateActivityRow[];
}

/** Resolve the private (0zk) fund-movement history across both chains newest-first, returning { available:false } when the bridge isn't in this binary; never throws and reuses the balance path's boot (engineInit + walletInfo), cheap when the Private tab already booted the engine. */
export async function fetchPrivateActivity(): Promise<PrivateActivityResult> {
  if (!isBridgeAvailable()) return { available: false, rows: [] };
  const key = await deriveRailgunKeyMaterial();
  try { await engineInit(); } catch { /* keep going; history call will no-op */ }
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
