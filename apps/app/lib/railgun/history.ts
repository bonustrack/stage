/** Private Railgun transfer history for the Activity tab.
 *
 *  Surfaces the shielded (0zk) transfer history alongside the public Etherscan
 *  activity: incoming receives (someone shielded-sent to our 0zk address) and
 *  outgoing 0zk->0zk transfers. This is the SAME read path that feeds balances:
 *  the embedded Node bridge's whitelisted `wallet.getTransactionHistory` SDK
 *  method (sdkDispatch.js → getWalletTransactionHistory), so it is PURE RN
 *  orchestration on the installed APK - no native change, hot-reloadable.
 *
 *  Flow per chain: derive key material (deriveKeys.ts) → engineInit (cheap when
 *  warm) → walletInfo (load-or-create the 0zk wallet, returns the walletID) →
 *  sdk('wallet.getTransactionHistory', [chain, walletID, undefined]). The SDK
 *  returns TransactionHistoryItem[]; we flatten each item's receive/transfer
 *  ERC20 amounts into one display row per token movement, tagged in/out.
 *
 *  Shields (deposits from the EOA) and unshields (withdrawals back to the EOA)
 *  are intentionally NOT surfaced here - this is the PRIVATE transfer view, and
 *  those legs already appear in the public Etherscan activity. Never throws:
 *  a chain that errors or has no shielded history is skipped, mirroring the
 *  balance refresh's best-effort posture. */
import { formatUnits } from 'viem';
import { isBridgeAvailable, engineInit, walletInfo } from './bridge';
import { sdk } from './bridge/sdk';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { RAILGUN_NETWORKS, type RailgunNet } from './networks';
import { RAILGUN_TOKENS, type TokenMeta } from './tokens';

/** One shielded transfer movement, pre-formatted for the Activity row. */
export interface PrivateActivityRow {
  /** Stable key: txid + direction + token (one item can have several). */
  key: string;
  direction: 'in' | 'out';
  /** Display symbol (ETH / USDC) when known, else a shortened token address. */
  symbol: string;
  /** Decimal-string amount (formatUnits output), e.g. "1.25". */
  amount: string;
  chainId: number;
  chainLabel: string;
  /** Unix seconds; 0 when the engine couldn't resolve the block time. */
  timestamp: number;
  txid: string;
}

/** Minimal slice of the SDK's TransactionHistoryItem we consume. The bridge
 *  serializes bigints to decimal strings, so `amount` arrives as a string. */
interface HistoryErc20Amount { tokenAddress: string; amount: string }
interface HistoryItem {
  txid: string;
  timestamp?: number | null;
  receiveERC20Amounts?: HistoryErc20Amount[];
  transferERC20Amounts?: HistoryErc20Amount[];
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

/** Flatten one history item's receive + transfer ERC20 legs into rows. Change
 *  outputs (self-change from a spend) and shield/unshield legs are excluded by
 *  only reading receiveERC20Amounts (in) and transferERC20Amounts (out). */
function rowsForItem(net: RailgunNet, item: HistoryItem): PrivateActivityRow[] {
  const cfg = RAILGUN_NETWORKS[net];
  const ts = typeof item.timestamp === 'number' ? item.timestamp : 0;
  const map = (a: HistoryErc20Amount, direction: 'in' | 'out'): PrivateActivityRow => {
    const meta = tokenForAddress(net, a.tokenAddress);
    let amount = a.amount;
    try { amount = formatUnits(BigInt(a.amount), meta?.decimals ?? 18); } catch { /* keep raw */ }
    return {
      key: `${item.txid}-${direction}-${a.tokenAddress}`,
      direction,
      symbol: meta?.symbol ?? shortToken(a.tokenAddress),
      amount,
      chainId: cfg.chainId,
      chainLabel: cfg.label,
      timestamp: ts,
      txid: item.txid,
    };
  };
  return [
    ...(item.receiveERC20Amounts ?? []).map((a) => map(a, 'in')),
    ...(item.transferERC20Amounts ?? []).map((a) => map(a, 'out')),
  ];
}

/** Fetch the shielded transfer history for one network. Best-effort: returns []
 *  on any failure (engine not warm, scan not ready, RPC hiccup). */
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

/** Resolve the private (0zk) transfer history across both supported chains,
 *  newest-first. Returns [] when the bridge isn't in this binary. Never throws.
 *  Reuses the balance read path's boot (engineInit + walletInfo); when the
 *  Private tab already booted the engine these calls are cheap. */
export async function fetchPrivateActivity(): Promise<PrivateActivityRow[]> {
  if (!isBridgeAvailable()) return [];
  const key = await deriveRailgunKeyMaterial();
  try { await engineInit(); } catch { /* keep going; history call will no-op */ }
  const info = await walletInfo({
    encryptionKey: key.encryptionKey,
    mnemonic: key.mnemonic,
    creationBlocks: key.creationBlocks,
  });
  const nets = Object.keys(RAILGUN_NETWORKS) as RailgunNet[];
  const perNet = await Promise.all(nets.map((n) => historyForNet(n, info.railgunWalletID)));
  return perNet.flat().sort((a, b) => b.timestamp - a.timestamp);
}
