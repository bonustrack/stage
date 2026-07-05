
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

export interface PingResult {
  pong: boolean;
  echo: unknown;
  node: string;
  at: number;
}

export async function pingBridge(payload?: unknown): Promise<PingResult> {
  return (await rawCall('ping', payload ?? { hello: 'metro' })) as PingResult;
}

export interface EngineStatusResult {
  ready: boolean;
  prover: boolean;
  networks: string[];
  version?: string | null;
  dbPath?: string;
  error?: string;
}

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
