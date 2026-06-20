import type {
  RailgunNet,
  CreateWalletParams,
  WalletResult,
  BalanceRowResult,
} from './protocol';
import type { TransferGasDetails, TransferErc20Recipient } from './transferCalls';
import type { UnshieldErc20Recipient } from './unshieldCalls';
import type { PopulateResult } from './shieldCalls';
import type { SdkMethod } from './methods';

export interface EngineStatus {
  ready: boolean;
  prover: boolean;
  networks: string[];
  version?: string | null;
  dbPath?: string;
  error?: string;
}

export interface BalancesSnapshot {
  net: RailgunNet;
  rows: BalanceRowResult[];
  scanning: boolean;
}

export interface EngineInitOptions {
  dev?: boolean;
  scanConfig?: unknown;
}

export interface RailgunBridgeAPI {
  isAvailable(): boolean;

  ping(payload?: unknown): Promise<{ pong: boolean; node: string; at: number }>;

  engineStatus(): Promise<EngineStatus>;

  engineInit(opts?: EngineInitOptions): Promise<EngineStatus>;

  getWallet(params: CreateWalletParams): Promise<WalletResult>;

  getBalances(walletId: string, net: RailgunNet): Promise<BalancesSnapshot>;

  scan(walletId: string, net: RailgunNet): Promise<void>;

  estimateShield(params: ShieldEstimateInput): Promise<{ gasEstimate: string }>;
  populateShield(params: ShieldPopulateInput): Promise<PopulateResult>;

  estimateTransfer(params: TransferFlowInput): Promise<{ gasEstimate: string }>;
  proveTransfer(params: TransferFlowInput): Promise<void>;
  populateTransfer(params: TransferPopulateInput): Promise<PopulateResult>;

  estimateUnshield(params: UnshieldFlowInput): Promise<{ gasEstimate: string }>;
  proveUnshield(params: UnshieldFlowInput): Promise<void>;
  populateUnshield(params: UnshieldPopulateInput): Promise<PopulateResult>;

  sdk<T = unknown>(method: SdkMethod, args?: readonly unknown[]): Promise<T>;

  listMethods(): Promise<string[]>;
}

export interface ShieldEstimateInput {
  txidVersion: string;
  networkName: string;
  fromAddress: string;
  recipients: { tokenAddress: string; amountWei: string; recipientAddress: string }[];
  gasDetails: TransferGasDetails;
}
export interface ShieldPopulateInput {
  txidVersion: string;
  networkName: string;
  railgunAddress: string;
  shieldPrivateKey: string;
  baseToken?: { wrappedTokenAddress: string; amountWei: string };
  erc20?: { tokenAddress: string; amountWei: string };
}

export interface TransferFlowInput {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  encryptionKey: string;
  erc20Recipients: TransferErc20Recipient[];
  gasDetails: TransferGasDetails;
}
export type TransferPopulateInput = Omit<TransferFlowInput, 'encryptionKey'>;

export interface UnshieldFlowInput {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  encryptionKey: string;
  erc20Recipients: UnshieldErc20Recipient[];
  gasDetails: TransferGasDetails;
}
export type UnshieldPopulateInput = Omit<UnshieldFlowInput, 'encryptionKey'>;
