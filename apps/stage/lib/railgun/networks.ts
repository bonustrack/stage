
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

export function netForChainId(chainId: number): RailgunNetworkConfig {
  return chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
}
