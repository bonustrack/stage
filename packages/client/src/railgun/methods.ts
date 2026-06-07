/** SINGLE SOURCE OF TRUTH for the Railgun bridge method surface.
 *
 *  THE DESYNC PROBLEM THIS SOLVES: before phase 2 the bridge method names lived
 *  as bare string literals in FOUR places that had to be hand-kept in sync -
 *    1. the RN frame builders (lib/railgun/.../shieldCalls/transferCalls/...),
 *    2. the RN sdk() dispatcher docs,
 *    3. the Node host whitelist (nodejs-assets/.../sdkDispatch.js WHITELIST),
 *    4. the Node host engine-op routing (main.js ENGINE_OPS / NOT_IMPL).
 *  Adding a method to one and forgetting another shipped a silent runtime gap
 *  (a call rejected with "not whitelisted" only at proof time on a real APK).
 *
 *  THE FIX: enumerate every method name ONCE here as a typed const. The RN frame
 *  builders import these literals (so a typo is a compile error); the Node host
 *  validates its WHITELIST against the generated manifest (railgun-methods.json,
 *  emitted from this file by scripts/gen-railgun-methods, asserted by a test) so
 *  a method that exists in the contract but not the host whitelist FAILS CI.
 *  Adding a method can no longer desync the four files.
 *
 *  PURE: no native / RN / expo imports. Plain string constants. */

/** Stateful ENGINE ops routed in the host to engine.js (it owns LevelDB + prover
 *  + provider wiring + the wallet cache). NOT in the SDK whitelist. */
export const ENGINE_OPS = [
  'initEngine',
  'engineStatus',
  'createWallet',
  'getAddress',
  'balances',
  'listMethods',
] as const;
export type EngineOp = (typeof ENGINE_OPS)[number];

/** High-level convenience calls the host answers directly on the channel without
 *  going through the generic `sdk` dispatcher (liveness + handshake + the typed
 *  engine lifecycle handlers). Mirrors the RN bridge ExtraCall union. */
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

/** Composite intents whose SHAPE the dispatcher supports but which RN composes
 *  from the whitelisted primitives (never run as a single host call). The host
 *  rejects these with `not_implemented` so an accidental direct call is loud. */
export const COMPOSITE_OPS = ['shield', 'privateTransfer', 'unshield'] as const;
export type CompositeOp = (typeof COMPOSITE_OPS)[number];

/** THE WHITELIST - every @railgun-community/wallet primitive the Node host may
 *  invoke by name. The RN frame builders reference these via SDK_METHOD (typed)
 *  so a name typo is a compile error; the host's WHITELIST keys MUST equal this
 *  set exactly (asserted by the dispatch-parity test). Grouped engine/wallet/
 *  balance/gas/proof/tx for readability; order is not significant. */
export const SDK_METHODS = [
  // engine lifecycle (lower-level than ENGINE_OPS; for advanced orchestration)
  'engine.has',
  'engine.get',
  'engine.loadProvider',
  'engine.unloadProvider',
  // wallet management
  'wallet.create',
  'wallet.createViewOnly',
  'wallet.loadByID',
  'wallet.deleteByID',
  'wallet.getAddress',
  'wallet.getAddressData',
  'wallet.getMnemonic',
  'wallet.getShareableViewingKey',
  'wallet.getTransactionHistory',
  // balances
  'balance.refresh',
  'balance.forERC20',
  'balance.getSerializedERC20',
  'balance.rescanFull',
  'balance.awaitWalletScan',
  // gas estimation
  'gas.estimateShield',
  'gas.estimateShieldBaseToken',
  'gas.estimateTransfer',
  'gas.estimateUnshield',
  'gas.estimateUnshieldBaseToken',
  // proof generation (Groth16 - the whole reason the Node host exists)
  'proof.transfer',
  'proof.unshield',
  'proof.unshieldBaseToken',
  // transaction population (returns a populated tx; RN signs + broadcasts)
  'tx.populateShield',
  'tx.populateShieldBaseToken',
  'tx.populateProvedTransfer',
  'tx.populateProvedUnshield',
  'tx.getShieldPrivateKeySignatureMessage',
] as const;

/** A whitelisted SDK method name (compile-time-checked literal union). */
export type SdkMethod = (typeof SDK_METHODS)[number];

/** Identity helper so call sites read `SDK_METHOD('tx.populateShield')` and get
 *  a compile error on a typo / removed name, instead of a silent string. */
export function SDK_METHOD<M extends SdkMethod>(m: M): M {
  return m;
}

/** The JSON-serializable manifest shipped to the Node host (via the generated
 *  railgun-methods.json). The host asserts its WHITELIST / engine-op / composite
 *  routing equals this so the contract and the host can never diverge silently. */
export interface RailgunMethodManifest {
  sdkMethods: readonly string[];
  engineOps: readonly string[];
  compositeOps: readonly string[];
}

/** Build the manifest object (used by the codegen script + the parity test). */
export function railgunMethodManifest(): RailgunMethodManifest {
  return {
    sdkMethods: [...SDK_METHODS].sort(),
    engineOps: [...ENGINE_OPS].sort(),
    compositeOps: [...COMPOSITE_OPS].sort(),
  };
}
