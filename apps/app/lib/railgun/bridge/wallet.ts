/** RN-side bridge wrappers for the RAILGUN wallet + shielded-balance calls
 *  (Kohaku phase 1-2). These are thin TYPED wrappers over the GENERIC `sdk()`
 *  dispatcher (./sdk.ts): `walletInfo` → sdk('createWallet'), `getBalances` →
 *  sdk('balances'). Routing those names back to engine.js's stateful logic
 *  (LevelDB + prover + wallet cache) happens in the host (main.js ENGINE_OPS),
 *  so the deterministic 0zk derivation + scan behavior is unchanged — but the
 *  wire path is now the one generic handler, so future ops need no new handler.
 *
 *  The deterministic key material (mnemonic + encryptionKey + creationBlocks) is
 *  derived on the RN side (lib/railgun/deriveKeys.ts) and passed IN so the EOA
 *  key never has to be re-derived in the Node host; see SECURITY note in
 *  ./index.ts. */
import { sdk } from './sdk';

/** Result of `walletInfo`: the active account's RAILGUN wallet, create-or-loaded
 *  in the Node host from deterministic key material (deriveKeys.ts). */
export interface WalletInfoResult {
  railgunWalletID: string;
  /** 0zk… shielded address — stable per account across launches. */
  railgunAddress: string;
}

/** One shielded ERC20 balance row, amount as a wei decimal string (bigint can't
 *  cross the JSON channel). */
export interface BridgeBalanceRow {
  tokenAddress: string;
  /** Decimal-string wei amount. */
  amount: string;
}

/** Result of `balances`: per-network shielded ERC20 rows + a scanning flag. The
 *  rows may be empty on a cold wallet while the Merkle-tree scan runs. */
export interface BalancesResult {
  walletId: string;
  networks: { mainnet: BridgeBalanceRow[]; sepolia: BridgeBalanceRow[] };
  scanning: boolean;
  /** Recent engine scan diagnostics (provider load, full UTXO rescan lifecycle,
   *  per-bucket balanceUpdate counts, RPC errors). Surfaced in the dev panel. */
  scanDebug?: { t: number; chain: number; msg: string }[];
}

/** Create-or-load the active account's RAILGUN wallet in the Node host and
 *  resolve its { railgunWalletID, railgunAddress }. Routed through the generic
 *  dispatcher (sdk('createWallet')) → engine.js, which inits the engine if cold.
 *  The deterministic key material is derived on RN and passed in so the EOA key
 *  never re-derives in Node. */
export async function walletInfo(params: {
  encryptionKey: string;
  mnemonic: string;
  creationBlocks: Record<string, number>;
}): Promise<WalletInfoResult> {
  return sdk<WalletInfoResult>('createWallet', [params]);
}

/** Trigger a shielded-balance scan for Ethereum + Sepolia and resolve the
 *  currently-known per-network ERC20 amounts. May be empty while scanning.
 *  Routed through sdk('balances') → engine.js's non-blocking scan + cache. */
export async function getBalances(walletId: string): Promise<BalancesResult> {
  return sdk<BalancesResult>('balances', [{ walletId }]);
}
