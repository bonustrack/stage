
import type { RailgunNetworkConfig } from './networks';
import { ensureProviderLoaded } from './bridge/shieldCalls';
import { RAILGUN_TOKENS, type TokenMeta } from './tokens';

export const TXID_VERSION = 'V2_PoseidonMerkle';

export function tokenMeta(chainId: number, symbol: string, kind: string): TokenMeta {
  const net = chainId === 1 ? 'mainnet' : 'sepolia';
  const meta = RAILGUN_TOKENS[net].find(t => t.symbol === symbol);
  if (!meta) throw new Error(`Unsupported ${kind} token: ${symbol}`);
  return meta;
}

export async function loadShieldProvider(cfg: RailgunNetworkConfig): Promise<void> {
  await ensureProviderLoaded(
    {
      chainId: cfg.chainId,
      providers: cfg.rpcUrls.map((url, i) => ({ provider: url, priority: i + 1, weight: 1 })),
    },
    cfg.networkName,
  );
}
