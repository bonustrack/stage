/** Railgun (private balances + shielded send / shield / unshield) pure logic.
 *
 *  EVERYTHING here is framework-agnostic wire-protocol: typed frame builders +
 *  message shapes for the nodejs-mobile bridge. The native bridge (engine boot,
 *  the embedded Node prover, the nodejs-mobile channel) stays in apps/app behind
 *  the injected RailgunTransport - this module never imports a native module. */

export type { RailgunDispatch } from './dispatch';
export { bn, type BigIntWire } from './wire';
export {
  SDK_METHODS, SDK_METHOD, ENGINE_OPS, EXTRA_CALLS, COMPOSITE_OPS,
  railgunMethodManifest,
  type SdkMethod, type EngineOp, type ExtraCall, type CompositeOp,
  type RailgunMethodManifest,
} from './methods';
export type {
  RailgunBridgeAPI, EngineStatus, BalancesSnapshot, EngineInitOptions,
  ShieldEstimateInput, ShieldPopulateInput,
  TransferFlowInput, TransferPopulateInput,
  UnshieldFlowInput, UnshieldPopulateInput,
} from './api';
export type {
  RailgunNet,
  BridgeCall,
  BridgeEvent,
  BridgeCallMap,
  CallParams,
  CallResult,
  InitParams,
  LoadProviderParams,
  CreateWalletParams,
  WalletResult,
  TokenAmountParam,
  ShieldParams,
  TransferParams,
  UnshieldParams,
  PopulatedTxResult,
  BalanceRowResult,
} from './protocol';
export {
  shieldPrivateKeyMessage,
  ensureProviderLoaded,
  populateShieldBaseToken,
  populateShieldErc20,
  type FallbackProviderConfig,
  type PopulatedTx,
  type PopulateResult,
} from './shieldCalls';
export {
  gasEstimateTransfer,
  generateTransferProof,
  populateProvedTransfer,
  type TransferGasDetails,
  type TransferErc20Recipient,
} from './transferCalls';
export {
  gasEstimateUnshield,
  generateUnshieldProof,
  populateProvedUnshield,
  type UnshieldGasDetails,
  type UnshieldErc20Recipient,
} from './unshieldCalls';
