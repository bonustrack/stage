/** Network registry for the Railgun SDK layer. Maps our two supported chains to
 *  the SDK's NetworkName + the RPC endpoints the engine polls.
 *
 *  Every network uses Snapshot's brovider RPC (rpc.brovider.xyz/<chainId>) — the
 *  same endpoint lib/tx.ts / lib/ens.ts / WalletScreen.data.ts use. brovider
 *  serves both mainnet (1) and Sepolia (11155111); the public Sepolia RPCs were
 *  rate-limited and broke the shield's loadProvider, so they're gone. Sepolia is
 *  the default for testing. */

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
    rpcUrls: ['https://rpc.brovider.xyz/11155111'],
  },
  mainnet: {
    net: 'mainnet',
    label: 'Ethereum',
    chainId: 1,
    networkName: NetworkName.Ethereum,
    rpcUrls: ['https://rpc.brovider.xyz/1'],
  },
};

export const DEFAULT_RAILGUN_NET: RailgunNet = 'sepolia';

/** Resolve the network config for a chainId; defaults to Sepolia when unknown. */
export function netForChainId(chainId: number): RailgunNetworkConfig {
  return chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
}
