/** Network registry for the Railgun SDK layer. Maps our two supported chains to
 *  the SDK's NetworkName + the RPC endpoints the engine polls.
 *
 *  Mainnet reuses Snapshot's brovider RPC (rpc.brovider.xyz/<chainId>) — the
 *  same endpoint lib/tx.ts / lib/ens.ts use. Sepolia isn't on brovider, so it
 *  points at public Sepolia RPCs (no key, rate-limited; swap for a keyed
 *  endpoint in a later pass). Sepolia is the default for testing. */

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
    rpcUrls: ['https://rpc.ankr.com/eth_sepolia', 'https://ethereum-sepolia-rpc.publicnode.com'],
  },
  mainnet: {
    net: 'mainnet',
    label: 'Ethereum',
    chainId: 1,
    networkName: NetworkName.Ethereum,
    rpcUrls: ['https://rpc.brovider.xyz/1', 'https://ethereum-rpc.publicnode.com'],
  },
};

export const DEFAULT_RAILGUN_NET: RailgunNet = 'sepolia';

/** Resolve the network config for a chainId; defaults to Sepolia when unknown. */
export function netForChainId(chainId: number): RailgunNetworkConfig {
  return chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
}
