/** @metro-labs/railgun-mobile - PUBLIC TYPED BARREL (phase 2 skeleton).
 *
 *  GOAL of the extraction (proposal #5): make the Railgun mobile bridge a
 *  self-contained, version-pinned package that exposes ONLY a typed public API.
 *  The app then imports THIS barrel and never reaches into nodejs-assets/ or the
 *  Expo plugin internals.
 *
 *  WHAT THIS SKELETON SHIPS NOW (contract-first, low blast radius):
 *    - the single typed bridge CONTRACT (RailgunBridgeAPI) + the shared method
 *      registry (SDK_METHODS) + wire protocol types, re-exported from the pure
 *      @stage-labs/client/railgun module that both RN and the Node host already
 *      consume. This is the desync-proof seam: a method added to the contract
 *      drives the generated manifest + the host whitelist parity test.
 *
 *  WHAT REMAINS (the physical MOVE - deferred, see PR notes; needs an APK to
 *  validate so it is intentionally NOT done in this code-only pass):
 *    - move apps/app/nodejs-assets/nodejs-project (main.js / engine.js /
 *      sdkDispatch.js / railgun-methods.json / scripts) into this package,
 *    - move apps/app/plugins/withNodejsMobile.js + nodejsMobileConfig.js +
 *      withGradleMemory.js here behind ./plugin,
 *    - move apps/app/lib/railgun/bridge/* (the RN client implementing
 *      RailgunBridgeAPI) here,
 *    - re-point apps/app/metro.config.js blockList, app.config.js plugin paths,
 *      and scripts/install-nodejs-project.js at the package location,
 *    - pin the @railgun-community/* + @railgun-privacy/native-prover versions in
 *      this package's own package.json (currently in nodejs-project/package.json).
 *  Each of those touches the native build graph, so they land in a follow-up
 *  with a matching APK rebuild (per the native-dep/APK sequencing rule).
 *
 *  PURE: this barrel re-exports type/registry only - no native module import. */

export type {
  RailgunBridgeAPI,
  EngineStatus,
  BalancesSnapshot,
  EngineInitOptions,
  ShieldEstimateInput,
  ShieldPopulateInput,
  TransferFlowInput,
  TransferPopulateInput,
  UnshieldFlowInput,
  UnshieldPopulateInput,
} from '@stage-labs/client/railgun';

export {
  SDK_METHODS,
  SDK_METHOD,
  ENGINE_OPS,
  EXTRA_CALLS,
  COMPOSITE_OPS,
  railgunMethodManifest,
} from '@stage-labs/client/railgun';

export type {
  SdkMethod,
  EngineOp,
  ExtraCall,
  CompositeOp,
  RailgunMethodManifest,
  RailgunDispatch,
  RailgunNet,
  BridgeCall,
  BridgeEvent,
  CallParams,
  CallResult,
  CreateWalletParams,
  WalletResult,
  BalanceRowResult,
} from '@stage-labs/client/railgun';
