/** @file Public barrel for the RN-side Railgun bridge client, re-exporting the transport plus the higher-level typed wrappers `pingBridge`/`engineInit` for liveness and engine+prover initialization. */

/** Public barrel keeping the higher-level typed wrappers (ping/engine status/init); the low-level transport lives in ./transport to avoid an import cycle, and the guard contract makes an absent runtime reject friendly without throwing on import. */
import type { ScanConfig } from './scanConfig';
import { DEFAULT_SCAN_CONFIG } from './scanConfig';
import { rawCall, ENGINE_INIT_TIMEOUT_MS } from './transport';

export { type ScanConfig } from './scanConfig';
export { setBridgeStatusListener } from './diagnostics';
export { walletInfo, getBalances } from './wallet';
export type { BridgeBalanceRow } from './wallet';
export {
  isBridgeAvailable,
  bridgeListen,
} from './transport';

export interface PingResult { /** handlers.ping liveness probe */
  pong: boolean;
  echo: unknown;
  node: string;
  at: number;
}

/** Round-trip a 'ping' — proves the APK booted the Node runtime + channel. */
export async function pingBridge(payload?: unknown): Promise<PingResult> {
  return (await rawCall('ping', payload ?? { hello: 'metro' })) as PingResult;
}

/** Engine readiness (engine.js). `prover` ⇒ Groth16 prover loaded. */
export interface EngineStatusResult {
  ready: boolean;
  prover: boolean;
  networks: string[];
  version?: string | null;
  dbPath?: string;
  error?: string;
}

/** Inits engine + prover + providers (idempotent), overriding the short timeout; scanConfig is passed in from RN (DEFAULT_SCAN_CONFIG mirrors the old hardcoded engine.js values 1:1). */
export async function engineInit(
  dev = __DEV__,
  scanConfig: ScanConfig = DEFAULT_SCAN_CONFIG,
): Promise<EngineStatusResult> {
  return (await rawCall(
    'engineInit',
    { walletSource: 'metro', dev, scanConfig },
    ENGINE_INIT_TIMEOUT_MS,
  )) as EngineStatusResult;
}
