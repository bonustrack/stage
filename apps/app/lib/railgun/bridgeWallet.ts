import { formatUnits } from 'viem';
import { stampTokenUrl } from '@stage-labs/kit/avatar';
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

export function mapEventRows(chainId: number, rows: BridgeBalanceRow[]): PrivateBalance[] {
  const net = (Object.keys(RAILGUN_NETWORKS) as RailgunNet[]).find(
    (n) => RAILGUN_NETWORKS[n].chainId === chainId,
  );
  return net ? mapRows(net, rows) : [];
}

function weiForToken(rows: BridgeBalanceRow[], address: string): bigint {
  let total = 0n;
  const want = address.toLowerCase();
  for (const r of rows) {
    if (r.tokenAddress.toLowerCase() !== want) continue;
    try { total += BigInt(r.amount); } catch { }
  }
  return total;
}

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
    patchBalanceDebug({ phase: 'error', refreshError: (e as Error).message });
  }
  return { zkAddress: info.railgunAddress, balances, updatedAt: Date.now(), scanning };
}
