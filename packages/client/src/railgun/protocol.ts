/** @file Typed request/response + event wire contract for the nodejs-mobile bridge to the embedded Railgun engine and Groth16 prover (which Hermes can't run as an N-API addon, so it lives in an embedded Node runtime); pure wire shape only, no native or RN imports. */

/** Supported Railgun networks. Re-declared here as a string union so the client package stays free of the @railgun-community native deps (the host maps these back to the SDK's NetworkName enum). */
export type RailgunNet = 'sepolia' | 'mainnet';

/** Named RPC calls the Node process registers handlers for. One string per operation; the IPC layer routes by this name. Keep in sync with the host side's `bridgeRegisterCall(<name>, handler)` registrations. */
export type BridgeCall =
  | 'engine:init'
  | 'engine:loadProvider'
  | 'wallet:create'
  | 'wallet:balances'
  | 'tx:shield'
  | 'tx:transfer'
  | 'tx:unshield'
  | 'proof:generateTransfer'
  | 'proof:generateUnshield';

/** Push events the Node process emits unsolicited (no request). Used for engine logs, balance-scan updates, and proof progress so the UI can show a live indicator during the ~20-30s proof. */
export type BridgeEvent =
  | 'event:message'
  | 'event:error'
  | 'event:balanceUpdate'
  | 'event:proofProgress'
  | 'event:scanProgress'
  | 'event:scanDebug'
  | 'event:heartbeat'
  | 'event:uncaughtException';

/** Engine bootstrap params. The encryption key + mnemonic are derived on the host side and passed IN so the secret never has to be re-derived in Node. */
export interface InitParams {
  walletSource: string;
  /** Absolute path inside the app sandbox for the engine LevelDB + artifacts. */
  dbPath: string;
  artifactsPath: string;
  dev: boolean;
}

export interface LoadProviderParams {
  net: RailgunNet;
  chainId: number;
  rpcUrls: string[];
}

export interface CreateWalletParams {
  /** keccak256(privateKey) hex (no 0x). Derived on the host, used as engine key. */
  encryptionKey: string;
  /** 12-word mnemonic deterministically derived from the account key. */
  mnemonic: string;
  creationBlocks: Record<string, number>;
}

export interface WalletResult {
  id: string;
  railgunAddress: string;
}

export interface TokenAmountParam {
  tokenAddress: string;
  /** Decimal-string amount (serialized - bigint can't cross the JSON channel). */
  amount: string;
}

export interface ShieldParams {
  net: RailgunNet;
  encryptionKey: string;
  /** Shield private key = keccak256(EOA signature) hex; signed on the host side. */
  shieldPrivateKey: string;
  fromAddress: string;
  token: TokenAmountParam;
  toRailgunAddress: string;
}

export interface TransferParams {
  net: RailgunNet;
  walletId: string;
  encryptionKey: string;
  token: TokenAmountParam;
  to0zkAddress: string;
}

export interface UnshieldParams {
  net: RailgunNet;
  walletId: string;
  encryptionKey: string;
  token: TokenAmountParam;
  toEoaAddress: string;
}

/** A populated transaction, serialized for the channel. The host broadcasts it with the active account (Node never holds the EOA key). */
export interface PopulatedTxResult {
  to: string;
  data: string;
  value: string;
  /** Optional gas fields, serialized as decimal strings. */
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

/** Maps each call name to its [params, result] tuple for end-to-end typing. */
export interface BridgeCallMap {
  'engine:init': [InitParams, boolean];
  'engine:loadProvider': [LoadProviderParams, boolean];
  'wallet:create': [CreateWalletParams, WalletResult];
  'wallet:balances': [{ walletId: string; net: RailgunNet }, BalanceRowResult[]];
  'tx:shield': [ShieldParams, PopulatedTxResult];
  'tx:transfer': [TransferParams, PopulatedTxResult];
  'tx:unshield': [UnshieldParams, PopulatedTxResult];
  'proof:generateTransfer': [TransferParams, boolean];
  'proof:generateUnshield': [UnshieldParams, boolean];
}

export interface BalanceRowResult {
  tokenAddress: string;
  /** Decimal-string balance. */
  amount: string;
}

export type CallParams<K extends BridgeCall> = BridgeCallMap[K & keyof BridgeCallMap][0];
export type CallResult<K extends BridgeCall> = BridgeCallMap[K & keyof BridgeCallMap][1];
