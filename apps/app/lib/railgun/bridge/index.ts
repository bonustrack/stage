/** RN-side RAILGUN bridge client — public barrel.
 *
 *  The low-level transport (channel boot, id-matched RPC, `rawCall`/`bridgeCall`)
 *  lives in ./transport so sdk.ts / wallet.ts can depend on it without importing
 *  this barrel (which re-exports them) — that would form an import cycle. This
 *  file keeps the higher-level typed wrappers (ping / engine status / init) and
 *  re-exports the rest so `from './bridge'` call sites are unchanged.
 *
 *  GUARD CONTRACT (like lib/railgun/native.ts): absent runtime ⇒ isBridge
 *  Available() false, calls reject friendly, nothing throws on import, bundler
 *  never resolves the native module. */
import type { ScanConfig } from './scanConfig';
import { DEFAULT_SCAN_CONFIG } from './scanConfig';
import { rawCall, ENGINE_INIT_TIMEOUT_MS } from './transport';

export { DEFAULT_SCAN_CONFIG, type ScanConfig, type ChainScanConfig } from './scanConfig';
export { setBridgeStatusListener } from './diagnostics';
export { walletInfo, getBalances } from './wallet';
export type { WalletInfoResult, BalancesResult, BridgeBalanceRow } from './wallet';
export {
  ENGINE_INIT_TIMEOUT_MS,
  isBridgeAvailable,
  startBridge,
  bridgeCall,
  bridgeListen,
} from './transport';

export interface PingResult { // handlers.ping liveness probe
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

/** Read engine status without forcing init (pollable). */
export async function engineStatus(): Promise<EngineStatusResult> {
  return (await rawCall('engineStatus', undefined)) as EngineStatusResult;
}

/** Init engine + prover + providers (idempotent); overrides the short timeout.
 *  scanConfig (per-chain enable, RPC urls, batch size, stall/attempt timeouts,
 *  heartbeat cadence) is passed IN from RN instead of being hardcoded in
 *  engine.js. DEFAULT_SCAN_CONFIG mirrors the old hardcoded values 1:1. */
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

export { onHeartbeat, type HeartbeatPayload } from './heartbeat';
