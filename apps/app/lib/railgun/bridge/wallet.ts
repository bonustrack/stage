/** RN-side bridge wrappers for the RAILGUN wallet + shielded-balance calls
 *  (Kohaku phase 1-2). Mirrors the ping/engineInit pattern in ./index.ts: each
 *  is a thin typed wrapper over the shared `rawCall` request/response primitive.
 *
 *  The deterministic key material (mnemonic + encryptionKey + creationBlocks) is
 *  derived on the RN side (lib/railgun/deriveKeys.ts) and passed IN so the EOA
 *  key never has to be re-derived in the Node host; see SECURITY note in
 *  ./index.ts. The Node-side handlers live in nodejs-assets/nodejs-project/
 *  engine.js (walletInfo / balances) + main.js (handler registration). */
import { rawCall, ENGINE_INIT_TIMEOUT_MS } from './index';

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
}

/** walletInfo inits the engine if cold, so it gets the engine-init headroom.
 *  Balance scans run in the background but the handler returns promptly. */
const BALANCES_TIMEOUT_MS = 30_000;

/** Create-or-load the active account's RAILGUN wallet in the Node host and
 *  resolve its { railgunWalletID, railgunAddress }. The deterministic key
 *  material is derived on RN and passed in so the EOA key never re-derives in
 *  Node. */
export async function walletInfo(params: {
  encryptionKey: string;
  mnemonic: string;
  creationBlocks: Record<string, number>;
}): Promise<WalletInfoResult> {
  return (await rawCall('walletInfo', params, ENGINE_INIT_TIMEOUT_MS)) as WalletInfoResult;
}

/** Trigger a shielded-balance scan for Ethereum + Sepolia and resolve the
 *  currently-known per-network ERC20 amounts. May be empty while scanning. */
export async function getBalances(walletId: string): Promise<BalancesResult> {
  return (await rawCall('balances', { walletId }, BALANCES_TIMEOUT_MS)) as BalancesResult;
}
