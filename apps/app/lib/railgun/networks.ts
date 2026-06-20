/** @file Network registry mapping the two supported chains to the Railgun SDK NetworkName and >=2 getLogs-capable public RPCs per net (loadProvider needs total weight >=2); NEVER brovider, which rejects eth_getLogs (code -32012) and breaks the merkletree scan. */

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
