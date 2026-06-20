
export type RailgunNet = 'sepolia' | 'mainnet';

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

export type BridgeEvent =
  | 'event:message'
  | 'event:error'
  | 'event:balanceUpdate'
  | 'event:proofProgress'
  | 'event:scanProgress'
  | 'event:scanDebug'
  | 'event:heartbeat'
  | 'event:uncaughtException';

export interface InitParams {
  walletSource: string;
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
  encryptionKey: string;
  mnemonic: string;
  creationBlocks: Record<string, number>;
}

export interface WalletResult {
  id: string;
  railgunAddress: string;
}

export interface TokenAmountParam {
  tokenAddress: string;
  amount: string;
}

export interface ShieldParams {
  net: RailgunNet;
  encryptionKey: string;
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

export interface PopulatedTxResult {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

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
  amount: string;
}

export type CallParams<K extends BridgeCall> = BridgeCallMap[K & keyof BridgeCallMap][0];
export type CallResult<K extends BridgeCall> = BridgeCallMap[K & keyof BridgeCallMap][1];
