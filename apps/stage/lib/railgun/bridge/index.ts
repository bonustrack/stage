
import type { ScanConfig } from './scanConfig';
import { DEFAULT_SCAN_CONFIG } from './scanConfig';
import { rawCall, ENGINE_INIT_TIMEOUT_MS } from './transport';
import { sdk } from './sdk';

export { type ScanConfig } from './scanConfig';
export { setBridgeStatusListener } from './diagnostics';
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

export interface WalletInfoResult {
  railgunWalletID: string;
  railgunAddress: string;
}

export interface BridgeBalanceRow {
  tokenAddress: string;
  amount: string;
}

export interface BalancesResult {
  walletId: string;
  networks: { mainnet: BridgeBalanceRow[]; sepolia: BridgeBalanceRow[] };
  scanning: boolean;
  scanDebug?: { t: number; chain: number; msg: string }[];
}

export async function walletInfo(params: {
  encryptionKey: string;
  mnemonic: string;
  creationBlocks: Record<string, number>;
}): Promise<WalletInfoResult> {
  return sdk<WalletInfoResult>('createWallet', [params]);
}

export async function getBalances(walletId: string): Promise<BalancesResult> {
  return sdk<BalancesResult>('balances', [{ walletId }]);
}
