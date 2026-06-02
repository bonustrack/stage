/** nodejs-mobile bridge protocol — the typed request/response contract between
 *  the RN app and the embedded Node process that actually runs the RAILGUN
 *  engine + Groth16 prover.
 *
 *  WHY A BRIDGE AT ALL: the on-device Groth16 prover (@railgun-privacy/native-
 *  prover) is a node-gyp/N-API `.node` addon. Hermes (the RN JS engine) cannot
 *  `require` a Node N-API addon, so proving is IMPOSSIBLE in the RN VM. RAILGUN's
 *  own reference app (Railway-Wallet) solves this by running the ENTIRE engine
 *  inside a real embedded Node runtime via `nodejs-mobile-react-native`, and
 *  talking to it over an IPC channel (`nodejs-mobile-ipc2`). This file mirrors
 *  that contract so our RN code can issue request/response calls and receive
 *  push events without depending on the Node-only types.
 *
 *  Transport (matches Railway): a single bi-directional message channel
 *  (`nodejs.channel.send` / `addListener`). `nodejs-mobile-ipc2` layers a
 *  request/response RPC on top (each call gets an id; the reply carries the same
 *  id). We re-declare the message NAMES + payload shapes here, strongly typed,
 *  so both ends agree at compile time. The Node side lives in
 *  nodejs-assets/nodejs-project/ (EXCLUDED from the Metro bundle — see
 *  metro.config.js blockList) and is bundled into the native binary at build. */

import type { RailgunNet } from '../networks';

/** Named RPC calls the Node process registers handlers for. One string per
 *  operation; the IPC layer routes by this name. Keep in sync with the Node
 *  side's `bridgeRegisterCall(<name>, handler)` registrations. */
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

/** Push events the Node process emits unsolicited (no request). Used for engine
 *  logs, balance-scan updates, and proof progress so the UI can show a live
 *  indicator during the ~20-30s proof. */
export type BridgeEvent =
  | 'event:message'
  | 'event:error'
  | 'event:balanceUpdate'
  | 'event:proofProgress'
  | 'event:scanProgress'
  | 'event:uncaughtException';

/** Engine bootstrap params. The encryption key + mnemonic are derived on the RN
 *  side (lib/railgun/sdkWallet.ts) and passed IN so the secret never has to be
 *  re-derived in Node; see SECURITY note in bridge/index.ts. */
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
  /** keccak256(privateKey) hex (no 0x). Derived on RN, used as engine key. */
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
  /** Decimal-string amount (serialized — bigint can't cross the JSON channel). */
  amount: string;
}

export interface ShieldParams {
  net: RailgunNet;
  encryptionKey: string;
  /** Shield private key = keccak256(EOA signature) hex; signed on RN side. */
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

/** A populated transaction, serialized for the channel. The RN side broadcasts
 *  it with the active account (Node never holds the EOA key). */
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
