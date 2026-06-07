/** @metro-labs/railgun-mobile - PUBLIC TYPED BARREL (phase 3).
 *
 *  GOAL of the extraction (proposal #5): make the Railgun mobile bridge a
 *  self-contained, version-pinned package that exposes ONLY a typed public API.
 *  The app imports THIS barrel and never reaches into the Expo plugin internals
 *  or the RN bridge client modules directly.
 *
 *  WHAT THIS PACKAGE NOW OWNS (phase 3 physical move):
 *    - the single typed bridge CONTRACT (RailgunBridgeAPI) + the shared method
 *      registry (SDK_METHODS) + wire protocol types, re-exported from the pure
 *      @stage-labs/client/railgun module that both RN and the Node host consume.
 *      This is the desync-proof seam: a method added to the contract drives the
 *      generated manifest + the host whitelist parity test.
 *    - the RN-side bridge client (./bridge) - the concrete typed RPC over the
 *      in-process nodejs-mobile channel (startBridge / bridgeCall / engineInit /
 *      wallet + balances + shield/transfer/unshield builders). Re-exported below.
 *    - the Expo config plugins (./plugin: withNodejsMobile, withGradleMemory and
 *      the pure nodejsMobileConfig transforms). app.config.js loads them from the
 *      package; test/railgunPluginConfig.test.ts asserts the pure transforms.
 *
 *  WHAT STILL LIVES IN apps/app (NATIVE BUILD-GRAPH CONSTRAINT, NOT a regression):
 *    - apps/app/nodejs-assets/nodejs-project/* (main.js / engine.js /
 *      sdkDispatch.js / railgun-methods.json / scripts). nodejs-mobile-react-
 *      native's gradle (CopyNodeProjectAssetsFolder + GenerateNodeProjectAssets
 *      Lists) reads the host strictly from "<expoProjectRoot>/nodejs-assets/
 *      nodejs-project" - the path is a FIXED convention of the native module, not
 *      configurable. Relocating it out of the app dir would make the native build
 *      bundle an empty host. It is therefore kept in place; this package's
 *      package.json mirrors its pinned @railgun-community/* versions as the
 *      single documented source of truth for the host dep set.
 *
 *  The bridge client touches the native channel only behind a runtime guard
 *  (isBridgeAvailable) so the Metro bundler never resolves the native module and
 *  nothing throws on import. */

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

/* ── RN bridge client (the concrete implementation; ./bridge) ──────────────
 * The whole runtime surface the app consumes: engine lifecycle, the ping /
 * status probes, the typed RPC, wallet + balances, and the shield / transfer /
 * unshield call builders. Imports stay guarded so import never touches native. */
export {
  isBridgeAvailable,
  startBridge,
  bridgeCall,
  rawCall,
  pingBridge,
  engineStatus,
  engineInit,
  bridgeListen,
  ENGINE_INIT_TIMEOUT_MS,
  DEFAULT_SCAN_CONFIG,
  setBridgeStatusListener,
  walletInfo,
  getBalances,
  sdk,
  sdkListMethods,
  onHeartbeat,
} from './bridge/index';

export type {
  PingResult,
  EngineStatusResult,
  ScanConfig,
  ChainScanConfig,
  WalletInfoResult,
  BalancesResult,
  BridgeBalanceRow,
  HeartbeatPayload,
} from './bridge/index';
