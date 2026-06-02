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
import type { PrivateBalance, PrivateSnapshot } from './types';

/** Map a network's raw wei rows to UI PrivateBalance rows. Without per-token
 *  metadata yet (phase 3), we assume 18 decimals and label by a short token
 *  address; symbol/name/logo enrichment is a later pass. Zero rows are dropped. */
function mapRows(net: RailgunNet, rows: BridgeBalanceRow[]): PrivateBalance[] {
  const cfg = RAILGUN_NETWORKS[net];
  const out: PrivateBalance[] = [];
  for (const r of rows) {
    let amount: bigint;
    try { amount = BigInt(r.amount); } catch { continue; }
    if (amount === 0n) continue;
    const short = `${r.tokenAddress.slice(0, 6)}…${r.tokenAddress.slice(-4)}`;
    out.push({
      symbol: short,
      name: cfg.label,
      chainId: cfg.chainId,
      balance: formatUnits(amount, 18),
      logoUrl: '',
    });
  }
  return out;
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
  try {
    const res = await getBalances(info.railgunWalletID);
    balances = [...mapRows('mainnet', res.networks.mainnet), ...mapRows('sepolia', res.networks.sepolia)];
  } catch { /* scan may not be ready; keep the 0zk address + prior balances */ }
  return { zkAddress: info.railgunAddress, balances, updatedAt: Date.now() };
}
