/* Generic RAILGUN SDK dispatcher — the GENERIC node-side surface.
 *
 *  WHY THIS EXISTS: every Kohaku feature (shield / private-transfer / unshield)
 *  is just a composition of @railgun-community/wallet calls. Rather than bake a
 *  bespoke node handler per feature (= one APK rebuild each), we expose ONE
 *  generic `sdk` handler (see main.js) that invokes a whitelisted SDK operation
 *  by name. The RN side then orchestrates the multi-step flows (estimate gas →
 *  prove → populate → broadcast) purely in JS — HOT-RELOADABLE, NO rebuild —
 *  as long as every primitive it needs is already in the WHITELIST below.
 *
 *  SAFETY: this is NOT arbitrary eval. `invoke(method, args)` only runs methods
 *  present in the explicit WHITELIST map. A method not in the map is rejected.
 *  To add a brand-new SDK primitive you must edit this map and ship a new APK;
 *  but the map already covers the full private-transfer surface of wallet@10.8.6
 *  (wallet mgmt, balances, gas estimation, proof generation, tx population), so
 *  shield/send/unshield are reachable from RN today without another rebuild.
 *
 *  Each whitelist entry is `(sdk, shared, args) => result`. We pass the loaded
 *  SDK + shared-models modules in so entries stay declarative. Results must be
 *  JSON-serializable (bigint → decimal string) since they cross the channel;
 *  callers that need bigints back should request decimal strings and re-parse.
 *
 *  This file is plain Node CommonJS (NOT Hermes). Excluded from the Metro bundle
 *  (metro.config.js blockList); built into the native binary by nodejs-mobile.
 */
'use strict';

/** Lazily-required SDK + shared-models, cached after the first call. They load
 *  the heavy native deps, so we only touch them once an `sdk` call arrives. */
let _sdk = null;
let _shared = null;
function loadSdk() {
  // eslint-disable-next-line global-require
  if (!_sdk) _sdk = require('@railgun-community/wallet');
  return _sdk;
}
function loadShared() {
  // eslint-disable-next-line global-require
  if (!_shared) _shared = require('@railgun-community/shared-models');
  return _shared;
}

/** Recursively REVIVE wire-encoded bigints on the INPUT path. JSON can't carry a
 *  bigint, so the RN side wraps every bigint arg as { __bigint: "<decimal>" }
 *  (see lib/railgun/bridge/wire.ts). The shield/transfer SDK primitives do real
 *  bigint arithmetic on `amount` (ShieldNoteERC20 etc.) and throw on a string, so
 *  we MUST turn these markers back into real bigints before invoking the SDK.
 *  Recurses through arrays + plain objects; leaves everything else untouched. */
function revive(value) {
  if (value && typeof value === 'object') {
    if (typeof value.__bigint === 'string') return BigInt(value.__bigint);
    if (Array.isArray(value)) return value.map(revive);
    const out = {};
    for (const k of Object.keys(value)) out[k] = revive(value[k]);
    return out;
  }
  return value;
}

/** Recursively convert bigint → decimal string so results survive JSON. Leaves
 *  everything else untouched. Used on every whitelist result before reply. */
function serialize(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = serialize(value[k]);
    return out;
  }
  return value;
}

/* ───────────────────────────── WHITELIST ──────────────────────────────────
 *  Maps a stable RN-facing method name → a thunk that runs the real SDK call.
 *  Names are RN-facing aliases (engine.* / wallet.* / gas.* / proof.* / tx.* /
 *  balance.*) so the RN orchestration reads intent-first and is insulated from
 *  minor SDK renames (only this file changes on an SDK bump). `args` is the
 *  positional array the RN caller passed; we forward it to the SDK fn as-is. */
const WHITELIST = Object.create(null);

function def(name, fn) {
  WHITELIST[name] = fn;
}

// ── Engine lifecycle ───────────────────────────────────────────────────────
// initEngine is handled specially by the host (engine.js owns the LevelDB +
// prover + provider wiring); we expose the lower-level pieces too for advanced
// RN orchestration / diagnostics without forcing a rebuild.
def('engine.has', (sdk) => sdk.hasEngine());
def('engine.get', (sdk) => {
  // getEngine() returns a live object graph with cycles + functions — NOT
  // serializable. Expose only a boolean liveness signal.
  try { return !!sdk.getEngine(); } catch (_e) { return false; }
});
def('engine.loadProvider', (sdk, _shared, a) => sdk.loadProvider(a[0], a[1], a[2]));
def('engine.unloadProvider', (sdk, _shared, a) => sdk.unloadProvider(a[0]));

// ── Wallet management ────────────────────────────────────────────────────────
def('wallet.create', (sdk, _shared, a) => sdk.createRailgunWallet(a[0], a[1], a[2]));
def('wallet.createViewOnly', (sdk, _shared, a) => sdk.createViewOnlyRailgunWallet(a[0], a[1], a[2]));
def('wallet.loadByID', (sdk, _shared, a) => sdk.loadWalletByID(a[0], a[1], a[2]));
def('wallet.deleteByID', (sdk, _shared, a) => sdk.deleteWalletByID(a[0]));
def('wallet.getAddress', (sdk, _shared, a) => sdk.getRailgunAddress(a[0]));
def('wallet.getAddressData', (sdk, _shared, a) => sdk.getRailgunWalletAddressData(a[0]));
def('wallet.getMnemonic', (sdk, _shared, a) => sdk.getWalletMnemonic(a[0], a[1]));
def('wallet.getShareableViewingKey', (sdk, _shared, a) => sdk.getWalletShareableViewingKey(a[0]));
def('wallet.getTransactionHistory', (sdk, _shared, a) => sdk.getWalletTransactionHistory(a[0], a[1], a[2]));

// ── Balances ──────────────────────────────────────────────────────────────────
def('balance.refresh', (sdk, _shared, a) => sdk.refreshBalances(a[0], a[1]));
def('balance.forERC20', (sdk, _shared, a) => sdk.balanceForERC20Token(a[0], a[1], a[2], a[3]));
def('balance.getSerializedERC20', (sdk, _shared, a) => sdk.getSerializedERC20Balances(a[0], a[1], a[2]));
def('balance.rescanFull', (sdk, _shared, a) => sdk.rescanFullUTXOMerkletreesAndWallets(a[0], a[1]));
def('balance.awaitWalletScan', (sdk, _shared, a) => sdk.awaitWalletScan(a[0], a[1]));

// ── Gas estimation ────────────────────────────────────────────────────────────
def('gas.estimateShield', (sdk, _shared, a) => sdk.gasEstimateForShield(a[0], a[1], a[2], a[3], a[4], a[5]));
def('gas.estimateShieldBaseToken', (sdk, _shared, a) => sdk.gasEstimateForShieldBaseToken(a[0], a[1], a[2], a[3], a[4], a[5]));
// gasEstimateForUnprovenTransfer takes 10 args: …, originalGasDetails (a[7]),
// feeTokenDetails (a[8]), sendWithPublicWallet (a[9]). For a self-broadcast
// transfer (no broadcaster) the trailing `sendWithPublicWallet` MUST be `true`
// — a dropped 9th/10th arg arrives undefined → wrong (broadcaster-fee) path.
def('gas.estimateTransfer', (sdk, _shared, a) => sdk.gasEstimateForUnprovenTransfer(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]));
// gasEstimateForUnprovenUnshield takes 9 args; the trailing `sendWithPublicWallet`
// (a[8]) MUST be forwarded — for a self-broadcast unshield (no broadcaster) it is
// `true`, and the SDK branches its dummy-proof broadcaster-fee iteration on it. A
// dropped 9th arg arrives undefined → wrong (broadcaster-fee) estimate path.
def('gas.estimateUnshield', (sdk, _shared, a) => sdk.gasEstimateForUnprovenUnshield(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]));
def('gas.estimateUnshieldBaseToken', (sdk, _shared, a) => sdk.gasEstimateForUnprovenUnshieldBaseToken(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]));

// ── Proof generation (Groth16 — the whole reason the Node host exists) ────────
// The trailing `progressCallback` is a FUNCTION and cannot cross the JSON bridge
// channel (it arrives undefined). The engine's transaction-batch invokes it
// UNGUARDED (`progressCallback(progress)`), so a missing callback throws mid-proof.
// We inject a host-side no-op so the proof completes; RN drives its own progress
// chips from the call lifecycle (proving → broadcasting → confirmed) instead.
const NOOP_PROGRESS = () => {};
// generateTransferProof takes 12 args; the FINAL one (a[11]) is progressCallback.
// Its extra leading args vs unshield are showSenderAddressToRecipient (a[4]) +
// memoText (a[5]). overallBatchMinGasPrice (a[10]) must be forwarded, with the
// host-injected no-op progress in slot 11.
def('proof.transfer', (sdk, _shared, a) => sdk.generateTransferProof(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11] || NOOP_PROGRESS));
def('proof.unshield', (sdk, _shared, a) => sdk.generateUnshieldProof(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9] || NOOP_PROGRESS));
def('proof.unshieldBaseToken', (sdk, _shared, a) => sdk.generateUnshieldBaseTokenProof(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9] || NOOP_PROGRESS));

// ── Transaction population (returns a populated tx; RN signs + broadcasts) ────
def('tx.populateShield', (sdk, _shared, a) => sdk.populateShield(a[0], a[1], a[2], a[3], a[4], a[5])
  .then(serializePopulated));
def('tx.populateShieldBaseToken', (sdk, _shared, a) => sdk.populateShieldBaseToken(a[0], a[1], a[2], a[3], a[4], a[5])
  .then(serializePopulated));
// populateProvedTransfer takes 11 args; the FINAL one (a[10]) is gasDetails — a
// dropped 11th arg leaves the populate with no gas → throws. Extra leading args
// vs unshield: showSenderAddressToRecipient (a[3]) + memoText (a[4]).
def('tx.populateProvedTransfer', (sdk, _shared, a) => sdk.populateProvedTransfer(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10])
  .then(serializePopulated));
def('tx.populateProvedUnshield', (sdk, _shared, a) => sdk.populateProvedUnshield(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8])
  .then(serializePopulated));
def('tx.getShieldPrivateKeySignatureMessage', (sdk) => sdk.getShieldPrivateKeySignatureMessage());

/** populate* fns resolve { transaction, ... } where transaction is an ethers
 *  TransactionRequest holding bigints. Flatten to JSON-safe decimal strings. */
function serializePopulated(res) {
  return serialize(res);
}

/** Run a whitelisted method. Throws (caller maps to {ok:false,error}) when the
 *  method is unknown so an unsupported op is a clear error, not a silent hang. */
async function invoke(method, args) {
  const fn = WHITELIST[method];
  if (!fn) {
    throw new Error('Railgun SDK method not whitelisted: ' + method + ' (needs a whitelist add + new APK)');
  }
  const sdk = loadSdk();
  const shared = loadShared();
  // Revive wire-encoded bigints ({ __bigint }) on the INPUT before the SDK runs
  // its bigint arithmetic; serialize bigints back to strings on the way out.
  const revived = revive(Array.isArray(args) ? args : []);
  const result = await fn(sdk, shared, revived);
  return serialize(result);
}

/** Names exposed — handy for an RN-side capability probe (which ops are
 *  reachable on THIS binary without a rebuild). */
function listMethods() {
  return Object.keys(WHITELIST).sort();
}

module.exports = { invoke, listMethods, serialize };
