/** @file RN-side thin typed wrappers for RAILGUN wallet info + shielded-balance calls, routing `walletInfo`/`getBalances` through the generic `sdk()` dispatcher to engine.js in the host; deterministic key material is derived on RN and passed in so the EOA key never re-derives in Node. */
import { sdk } from './sdk';

/** Result of `walletInfo`: the active account's RAILGUN wallet, create-or-loaded in the Node host from deterministic key material (deriveKeys.ts). */
export interface WalletInfoResult {
  railgunWalletID: string;
  /** 0zk… shielded address — stable per account across launches. */
  railgunAddress: string;
}

/** One shielded ERC20 balance row, amount as a wei decimal string (bigint can't cross the JSON channel). */
export interface BridgeBalanceRow {
  tokenAddress: string;
  /** Decimal-string wei amount. */
  amount: string;
}

/** Result of `balances`: per-network shielded ERC20 rows + a scanning flag. The rows may be empty on a cold wallet while the Merkle-tree scan runs. */
export interface BalancesResult {
  walletId: string;
  networks: { mainnet: BridgeBalanceRow[]; sepolia: BridgeBalanceRow[] };
  scanning: boolean;
  /** Recent engine scan diagnostics (provider load, full UTXO rescan lifecycle, per-bucket balanceUpdate counts, RPC errors). Surfaced in the dev panel. */
  scanDebug?: { t: number; chain: number; msg: string }[];
}

/** Create-or-load the active account's RAILGUN wallet in the Node host and resolve { railgunWalletID, railgunAddress }, routed through sdk('createWallet') → engine.js (which inits the engine if cold); key material is derived on RN and passed in. */
export async function walletInfo(params: {
  encryptionKey: string;
  mnemonic: string;
  creationBlocks: Record<string, number>;
}): Promise<WalletInfoResult> {
  return sdk<WalletInfoResult>('createWallet', [params]);
}

/** Trigger a shielded-balance scan for Ethereum + Sepolia and resolve the currently-known per-network ERC20 amounts. May be empty while scanning. Routed through sdk('balances') → engine.js's non-blocking scan + cache. */
export async function getBalances(walletId: string): Promise<BalancesResult> {
  return sdk<BalancesResult>('balances', [{ walletId }]);
}
