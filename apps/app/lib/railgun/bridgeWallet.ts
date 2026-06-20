/** @file Bridge-backed private-wallet refresh (the real on-device path via the embedded Node host): derives keys, inits the engine, then reads the 0zk address + shielded balances into the UI's PrivateBalance shape; may be empty mid-scan and never throws. */
import { formatUnits } from 'viem';
import { stampTokenUrl } from '@metro-labs/kit/avatar';
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
import { patchBalanceDebug } from './balanceDebug';
import type { PrivateBalance, PrivateSnapshot } from './types';

/** Map raw wei rows for a chainId (not net) → fixed display rows. Used by the live balanceUpdate watcher, which only knows the numeric chain id. */
export function mapEventRows(chainId: number, rows: BridgeBalanceRow[]): PrivateBalance[] {
  const net = (Object.keys(RAILGUN_NETWORKS) as RailgunNet[]).find(
    (n) => RAILGUN_NETWORKS[n].chainId === chainId,
  );
  return net ? mapRows(net, rows) : [];
}

/** Sum the engine's wei rows for a given token address (case-insensitive). Railgun keys balances by ERC20 contract address; native ETH lands under the network's WETH address (see tokens.ts). A token absent from the rows is 0. */
function weiForToken(rows: BridgeBalanceRow[], address: string): bigint {
  let total = 0n;
  const want = address.toLowerCase();
  for (const r of rows) {
    if (r.tokenAddress.toLowerCase() !== want) continue;
    try { total += BigInt(r.amount); } catch { /* skip malformed */ }
  }
  return total;
}

/** Map a network's raw wei rows to the FIXED ETH + USDC display rows, formatted by each token's real decimals (ETH/WETH 18, USDC 6). Rows are emitted even at zero so the tab always shows both tokens per network. */
function mapRows(net: RailgunNet, rows: BridgeBalanceRow[]): PrivateBalance[] {
  const cfg = RAILGUN_NETWORKS[net];
  return RAILGUN_TOKENS[net].map((t) => ({
    symbol: t.symbol,
    name: t.name,
    chainId: cfg.chainId,
    balance: formatUnits(weiForToken(rows, t.address), t.decimals),
    logoUrl: stampTokenUrl(t.logoChainId, t.logoAddress, 32),
  }));
}

/** Resolve the live private snapshot (0zk address + shielded balances) via the embedded Node bridge, returning null when the bridge isn't in this binary and throwing only on genuine derivation/call failure. */
export async function bridgeRefreshSnapshot(prev: PrivateSnapshot | null): Promise<PrivateSnapshot | null> {
  if (!isBridgeAvailable()) {
    patchBalanceDebug({ bridgeAvailable: false, phase: 'idle' });
    return null;
  }
  patchBalanceDebug({ bridgeAvailable: true, phase: 'scanning', refreshError: null, refreshAt: Date.now() });
  const key = await deriveRailgunKeyMaterial();
  try {
    const st = await engineInit();
    patchBalanceDebug({ engineReady: st.ready, engineError: st.error ?? null });
  } catch (e) {
    patchBalanceDebug({ engineReady: false, engineError: (e as Error).message });
  }
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
    patchBalanceDebug({
      phase: 'done',
      getBalancesRows: { mainnet: res.networks.mainnet.length, sepolia: res.networks.sepolia.length },
    });
  } catch (e) {
    /** scan may not be ready; keep the 0zk address + prior balances */
    patchBalanceDebug({ phase: 'error', refreshError: (e as Error).message });
  }
  return { zkAddress: info.railgunAddress, balances, updatedAt: Date.now(), scanning };
}
