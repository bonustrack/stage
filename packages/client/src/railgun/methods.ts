
export const ENGINE_OPS = [
  'initEngine',
  'engineStatus',
  'createWallet',
  'getAddress',
  'balances',
  'listMethods',
] as const;
export type EngineOp = (typeof ENGINE_OPS)[number];

export const EXTRA_CALLS = [
  'ping',
  'hello',
  'engineStatus',
  'engineInit',
  'walletInfo',
  'balances',
  'sdk',
] as const;
export type ExtraCall = (typeof EXTRA_CALLS)[number];

export const COMPOSITE_OPS = ['shield', 'privateTransfer', 'unshield'] as const;
export type CompositeOp = (typeof COMPOSITE_OPS)[number];

export const SDK_METHODS = [
  'engine.has',
  'engine.get',
  'engine.loadProvider',
  'engine.unloadProvider',
  'wallet.create',
  'wallet.createViewOnly',
  'wallet.loadByID',
  'wallet.deleteByID',
  'wallet.getAddress',
  'wallet.getAddressData',
  'wallet.getMnemonic',
  'wallet.getShareableViewingKey',
  'wallet.getTransactionHistory',
  'balance.refresh',
  'balance.forERC20',
  'balance.getSerializedERC20',
  'balance.rescanFull',
  'balance.awaitWalletScan',
  'gas.estimateShield',
  'gas.estimateShieldBaseToken',
  'gas.estimateTransfer',
  'gas.estimateUnshield',
  'gas.estimateUnshieldBaseToken',
  'proof.transfer',
  'proof.unshield',
  'proof.unshieldBaseToken',
  'tx.populateShield',
  'tx.populateShieldBaseToken',
  'tx.populateProvedTransfer',
  'tx.populateProvedUnshield',
  'tx.getShieldPrivateKeySignatureMessage',
] as const;

export type SdkMethod = (typeof SDK_METHODS)[number];

export function SDK_METHOD<M extends SdkMethod>(m: M): M {
  return m;
}

export interface RailgunMethodManifest {
  sdkMethods: readonly string[];
  engineOps: readonly string[];
  compositeOps: readonly string[];
}

export function railgunMethodManifest(): RailgunMethodManifest {
  return {
    sdkMethods: [...SDK_METHODS].sort(),
    engineOps: [...ENGINE_OPS].sort(),
    compositeOps: [...COMPOSITE_OPS].sort(),
  };
}
