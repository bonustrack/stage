/** Runtime scan + RPC configuration passed from RN into the embedded engine at
 *  engineInit time (Phase 1).
 *
 *  These values used to be HARDCODED inside nodejs-assets/nodejs-project/engine.js
 *  (baked into the APK, untunable without a rebuild). Lifting them here lets RN
 *  own the policy: per-chain enable, RPC endpoints, JSON-RPC batch sizing, and the
 *  per-attempt stall timeout. The engine still falls back to its own identical
 *  defaults if a field is omitted, so this is behavior-preserving by default.
 *
 *  IMPORTANT: changing these does NOT need an APK rebuild as long as engine.js
 *  (which reads them) is already in the installed binary - the values travel over
 *  the in-process channel at init. The DEFAULTS below intentionally mirror the
 *  current engine.js constants 1:1 so Phase 1 ships with identical behavior. */
import type { RailgunNet } from './protocol';

/** Per-chain scan policy. `enabled` gates BOTH provider load and scanning. */
interface ChainScanConfig {
  net: RailgunNet;
  chainId: number;
  enabled: boolean;
  /** getLogs-capable RPCs, priority order. >= 2 for the fallback-provider quorum. */
  rpcUrls: string[];
}

/** Full runtime scan config handed to engineInit. All optional on the wire; the
 *  engine applies its baked-in defaults per missing field. */
export interface ScanConfig {
  chains: ChainScanConfig[];
  /** ethers batchMaxCount. 1 = disable JSON-RPC batching (reliable on testnets). */
  maxLogsPerBatch: number;
  /** Per-provider stall timeout (ms) before the fallback provider fails over. */
  stallTimeoutMs: number;
  /** ms before a single scan attempt is treated as hung and retried. */
  scanAttemptTimeoutMs: number;
  /** Max scan attempts per chain+wallet before giving up. */
  scanMaxAttempts: number;
  /** ms cadence of the engine status heartbeat (event:heartbeat). 0 disables. */
  heartbeatIntervalMs: number;
}

/** dRPC Sepolia (PRIMARY, reliable eth_getLogs) + public fallbacks. Mirrors
 *  engine.js RPC.sepolia and apps/app/lib/railgun/networks.ts. */
const SEPOLIA_RPCS = [
  'https://lb.drpc.org/ogrpc?network=sepolia&dkey=AqrKBDkAZkycokrrHI5M--EgA5HAYAQR8ZoW7sA_udJz',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
];

const MAINNET_RPCS = ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'];

/** Canonical default config. Sepolia ONLY is scan-enabled (mainnet's getLogs
 *  failures grab the global rescan lock and wedge Sepolia at 50% - see engine.js
 *  SCAN_CHAIN_IDS doc). Identical to the pre-Phase-1 hardcoded behavior. */
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
