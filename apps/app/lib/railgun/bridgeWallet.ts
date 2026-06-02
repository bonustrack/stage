/** Bridge-backed private-wallet refresh (Kohaku phase 1-2).
 *
 *  This is the REAL path on a device build: the RAILGUN engine only inits inside
 *  the embedded Node host (Hermes can't load the prover), so the actual 0zk
 *  address + shielded balances come from the bridge — not the Hermes direct-SDK
 *  modules (sdkWallet/sdkEngine), which can't init the engine on-device.
 *
 *  Flow: derive deterministic key material (deriveKeys.ts) → engineInit (cheap
 *  if already warm) → walletInfo (create-or-load the 0zk wallet) → getBalances
 *  (trigger a scan + read current amounts). Maps wei rows to the UI's
 *  PrivateBalance shape. Balances may be empty while the Merkle scan runs —
 *  that's expected and renders as the $0/empty state. Never throws. */
import { formatUnits } from 'viem';
import {
  isBridgeAvailable,
  engineInit,
  walletInfo,
  getBalances,
  type BridgeBalanceRow,
} from './bridge';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { RAILGUN_NETWORKS, type RailgunNet } from './networks';
import { RAILGUN_TOKENS } from './tokens';
import type { PrivateBalance, PrivateSnapshot } from './types';

/** Sum the engine's wei rows for a given token address (case-insensitive).
 *  Railgun keys balances by ERC20 contract address; native ETH lands under the
 *  network's WETH address (see tokens.ts). A token absent from the rows is 0. */
function weiForToken(rows: BridgeBalanceRow[], address: string): bigint {
  let total = 0n;
  const want = address.toLowerCase();
  for (const r of rows) {
    if (r.tokenAddress.toLowerCase() !== want) continue;
    try { total += BigInt(r.amount); } catch { /* skip malformed */ }
  }
  return total;
}

/** Map a network's raw wei rows to the FIXED ETH + USDC display rows, formatted
 *  by each token's real decimals (ETH/WETH 18, USDC 6). Rows are emitted even at
 *  zero so the tab always shows both tokens per network. */
function mapRows(net: RailgunNet, rows: BridgeBalanceRow[]): PrivateBalance[] {
  const cfg = RAILGUN_NETWORKS[net];
  return RAILGUN_TOKENS[net].map((t) => ({
    symbol: t.symbol,
    name: cfg.label,
    chainId: cfg.chainId,
    balance: formatUnits(weiForToken(rows, t.address), t.decimals),
    logoUrl: '',
  }));
}

/** Resolve the live private snapshot (0zk address + shielded balances) via the
 *  embedded Node bridge. Returns null when the bridge isn't in this binary so
 *  the caller can fall back. Throws only on genuine derivation/call failure
 *  (caught by the caller, which keeps the warm cache). */
export async function bridgeRefreshSnapshot(prev: PrivateSnapshot | null): Promise<PrivateSnapshot | null> {
  if (!isBridgeAvailable()) return null;
  const key = await deriveRailgunKeyMaterial();
  await engineInit();
  const info = await walletInfo({
    encryptionKey: key.encryptionKey,
    mnemonic: key.mnemonic,
    creationBlocks: key.creationBlocks,
  });
  let balances = prev?.balances ?? [];
  let scanning = false;
  try {
    const res = await getBalances(info.railgunWalletID);
    balances = [...mapRows('mainnet', res.networks.mainnet), ...mapRows('sepolia', res.networks.sepolia)];
    scanning = res.scanning;
  } catch { /* scan may not be ready; keep the 0zk address + prior balances */ }
  return { zkAddress: info.railgunAddress, balances, updatedAt: Date.now(), scanning };
}
