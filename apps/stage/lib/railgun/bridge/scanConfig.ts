import type { RailgunNet } from './protocol';

interface ChainScanConfig {
  net: RailgunNet;
  chainId: number;
  enabled: boolean;
  rpcUrls: string[];
}

export interface ScanConfig {
  chains: ChainScanConfig[];
  maxLogsPerBatch: number;
  stallTimeoutMs: number;
  scanAttemptTimeoutMs: number;
  scanMaxAttempts: number;
  heartbeatIntervalMs: number;
}

const SEPOLIA_RPCS = [
  'https://lb.drpc.org/ogrpc?network=sepolia&dkey=AqrKBDkAZkycokrrHI5M--EgA5HAYAQR8ZoW7sA_udJz',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
];

const MAINNET_RPCS = ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'];

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  chains: [
    { net: 'mainnet', chainId: 1, enabled: false, rpcUrls: MAINNET_RPCS },
    { net: 'sepolia', chainId: 11155111, enabled: true, rpcUrls: SEPOLIA_RPCS },
  ],
  maxLogsPerBatch: 1,
  stallTimeoutMs: 5000,
  scanAttemptTimeoutMs: 90 * 1000,
  scanMaxAttempts: 4,
  heartbeatIntervalMs: 5000,
};
