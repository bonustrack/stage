/** Network registry for the Railgun SDK layer. Maps our two supported chains to
 *  the SDK's NetworkName + the RPC endpoints the engine polls.
 *
 *  IMPORTANT — do NOT use brovider (rpc.brovider.xyz) here. brovider is a
 *  multicall-oriented proxy that REJECTS eth_getLogs ("getLogs request exceeded
 *  max allowed range", code -32012) even for a single block, so the Railgun
 *  engine's merkletree scan can't run. (brovider is fine for lib/tx.ts /
 *  lib/ens.ts public-wallet multicall reads — just not for the SDK scan.)
 *
 *  Railgun's loadProvider also requires total provider weight >= 2 for fallback
 *  quorum (createFallbackProviderFromJsonConfig throws "Invalid fallback
 *  provider config" otherwise) — sdkEngine assigns weight 1 per url, so each
 *  net needs >= 2 urls. We use two getLogs-capable public RPCs per net,
 *  empirically verified to serve eth_getLogs over the Railgun proxy address:
 *    - ethereum-sepolia-rpc.publicnode.com  (getLogs OK, 50k-block range cap)
 *    - sepolia.drpc.org                     (getLogs OK, 10k-block range cap)
 *  The engine chunks its scan well under both caps. Sepolia is the test default. */

import { NetworkName } from '@railgun-community/shared-models';

export type RailgunNet = 'sepolia' | 'mainnet';

export interface RailgunNetworkConfig {
  net: RailgunNet;
  label: string;
  chainId: number;
  networkName: NetworkName;
  rpcUrls: string[];
}

export const RAILGUN_NETWORKS: Record<RailgunNet, RailgunNetworkConfig> = {
  sepolia: {
    net: 'sepolia',
    label: 'Sepolia',
    chainId: 11155111,
    networkName: NetworkName.EthereumSepolia,
    rpcUrls: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
    ],
  },
  mainnet: {
    net: 'mainnet',
    label: 'Ethereum',
    chainId: 1,
    networkName: NetworkName.Ethereum,
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
    ],
  },
};

export const DEFAULT_RAILGUN_NET: RailgunNet = 'sepolia';

/** Resolve the network config for a chainId; defaults to Sepolia when unknown. */
export function netForChainId(chainId: number): RailgunNetworkConfig {
  return chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
}

/** Block-explorer base URL per chainId. Covers our supported chains plus a few
 *  common L2s so tx links are correct on every network (not just mainnet). */
const EXPLORER_BASE: Record<number, string> = {
  1: 'https://etherscan.io',
  10: 'https://optimistic.etherscan.io',
  137: 'https://polygonscan.com',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  11155111: 'https://sepolia.etherscan.io',
};

/** Chain-aware block-explorer tx URL. Falls back to mainnet etherscan only when
 *  the chainId is unknown. */
export function explorerTxUrl(chainId: number, txHash: string): string {
  return `${EXPLORER_BASE[chainId] ?? 'https://etherscan.io'}/tx/${txHash}`;
}
