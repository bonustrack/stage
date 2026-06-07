/** THE Railgun bridge contract - one TypeScript interface enumerating the full
 *  public bridge surface (engine lifecycle, wallet, balances, the shield /
 *  private-transfer / unshield flows, and the live push events).
 *
 *  WHY ONE INTERFACE: phase 1 spread the surface across bridge/index.ts (engine
 *  lifecycle), bridge/wallet.ts (wallet + balances), and the *Calls frame
 *  builders. RailgunBridgeAPI gathers the intent-level operations into a single
 *  typed contract so a consumer (and the host) has ONE place describing what the
 *  bridge can do. The concrete RN client (@metro-labs/railgun-mobile barrel /
 *  apps/app/lib/railgun/bridge) implements it; the wire frames + method registry
 *  (./protocol, ./methods) back it. The lower-level generic `sdk(method, args)`
 *  dispatcher stays available for advanced orchestration, but every step it can
 *  run is enumerated in SDK_METHODS so the contract and host cannot desync.
 *
 *  PURE: type-only. No native / RN / expo imports. */
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

/** Engine readiness snapshot (mirrors the host engine.js status()). */
export interface EngineStatus {
  ready: boolean;
  /** Groth16 native prover loaded. */
  prover: boolean;
  networks: string[];
  version?: string | null;
  dbPath?: string;
  error?: string;
}

/** Per-network shielded-balance result (+ a live scan flag). */
export interface BalancesSnapshot {
  net: RailgunNet;
  rows: BalanceRowResult[];
  scanning: boolean;
}

/** Engine init options passed from RN (scanConfig is structural to avoid pulling
 *  the RN-side ScanConfig type into the pure client; the host validates it). */
export interface EngineInitOptions {
  dev?: boolean;
  scanConfig?: unknown;
}

/** The full intent-level Railgun bridge contract. The RN client implements this
 *  over the nodejs-mobile channel; nothing here imports a native module. Every
 *  method maps to either a typed host handler (engine lifecycle / wallet /
 *  balances) or a composition of whitelisted SDK_METHODS (the tx flows). */
export interface RailgunBridgeAPI {
  /** True when the embedded Node runtime can serve calls on this binary. */
  isAvailable(): boolean;

  /** Round-trip liveness probe (proves the Node runtime booted + channel works). */
  ping(payload?: unknown): Promise<{ pong: boolean; node: string; at: number }>;

  /** Read engine state without forcing init (pollable). */
  engineStatus(): Promise<EngineStatus>;

  /** Init engine + native prover + RPC providers (idempotent). */
  engineInit(opts?: EngineInitOptions): Promise<EngineStatus>;

  /** Create-or-load the deterministic Railgun wallet for the active account. */
  getWallet(params: CreateWalletParams): Promise<WalletResult>;

  /** Currently-known shielded balances for a network (non-blocking). */
  getBalances(walletId: string, net: RailgunNet): Promise<BalancesSnapshot>;

  /** Trigger a shielded-balance rescan for a wallet on a network. */
  scan(walletId: string, net: RailgunNet): Promise<void>;

  /** Populate a SHIELD tx (public -> private). RN signs + broadcasts. The shape
   *  is the SHIELD intent; the impl composes the whitelisted populateShield* . */
  estimateShield(params: ShieldEstimateInput): Promise<{ gasEstimate: string }>;
  populateShield(params: ShieldPopulateInput): Promise<PopulateResult>;

  /** Private TRANSFER (private -> private): estimate -> prove -> populate. */
  estimateTransfer(params: TransferFlowInput): Promise<{ gasEstimate: string }>;
  proveTransfer(params: TransferFlowInput): Promise<void>;
  populateTransfer(params: TransferPopulateInput): Promise<PopulateResult>;

  /** UNSHIELD (private -> public): estimate -> prove -> populate. */
  estimateUnshield(params: UnshieldFlowInput): Promise<{ gasEstimate: string }>;
  proveUnshield(params: UnshieldFlowInput): Promise<void>;
  populateUnshield(params: UnshieldPopulateInput): Promise<PopulateResult>;

  /** The generic escape hatch: invoke one whitelisted SDK primitive by name. The
   *  method param is the SdkMethod union so an unknown name is a compile error. */
  sdk<T = unknown>(method: SdkMethod, args?: readonly unknown[]): Promise<T>;

  /** Capability probe: SDK methods reachable on THIS binary (no rebuild). */
  listMethods(): Promise<string[]>;
}

/** Inputs for the SHIELD intent (RN supplies txidVersion/network strings). */
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
  /** native-ETH base-token shield when set, else ERC20. */
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
