/* RAILGUN engine + Groth16 prover host — runs inside nodejs-mobile-react-native.
 *
 *  WHY THIS FILE EXISTS: the on-device Groth16 prover (@railgun-privacy/native-
 *  prover) is a Node N-API `.node` addon that Hermes cannot load. The ONLY way
 *  to generate proofs on-device is to run the whole RAILGUN engine inside a real
 *  embedded Node runtime (this process) and talk to it from RN over the
 *  nodejs-mobile message channel. This mirrors RAILGUN's reference app
 *  (Railway-Wallet, mobile/nodejs-src/nodejs-project/src/main.ts).
 *
 *  STATUS (Milestone 1): boot + ping stay dependency-free here; the RAILGUN
 *  engine + Groth16 native prover are wired in ./engine.js and loaded lazily on
 *  the first engineInit/engineStatus call (see handlers below). Full private
 *  send/receive (wallet:create, tx:*, proof:*) is a later milestone.
 *
 *  This folder is EXCLUDED from the Metro bundle (see apps/app/metro.config.js
 *  resolver.blockList) so RN never tries to bundle these node-only files. It is
 *  bundled into the NATIVE binary at build time by nodejs-mobile-react-native.
 *
 *  WIRE PROTOCOL (must match apps/app/lib/railgun/bridge/protocol.ts):
 *    RN -> Node:  channel event 'rg:request'  { id, call, params }
 *    Node -> RN:  channel event 'rg:reply'    { id, ok, result?, error? }
 *    Node -> RN:  push events 'event:message' | 'event:error' |
 *                 'event:balanceUpdate' | 'event:proofProgress' | ...
 *
 *  NEXT STEPS to make this real (documented, NOT yet done — needs a new APK):
 *    1. cd nodejs-assets/nodejs-project && add deps (see package.json TODO):
 *         @railgun-community/wallet, @railgun-community/shared-models,
 *         @railgun-privacy/native-prover (IPFS tarball, v4.0.3),
 *         leveldown-nodejs-mobile, ethers, nodejs-mobile-ipc2.
 *    2. startRailgunEngine(walletSource, levelDB, dev, artifactStore, ...).
 *    3. getEngine().prover.setNativeProverGroth16(nativeProveRailgun,
 *         nativeProvePOI, CIRCUITS)  from @railgun-privacy/native-prover.
 *    4. Register a handler per BridgeCall (engine:init, wallet:create,
 *         tx:shield, proof:generateTransfer, ...) and reply on 'rg:reply'.
 */

'use strict';

// nodejs-mobile's Node v18 is compiled WITHOUT full ICU, so V8 rejects
// `new TextDecoder('utf-8', { fatal: true })` with:
//   "fatal" option is not supported on Node.js compiled without ICU
// RAILGUN's wasm-bindgen glue (@railgun-community/poseidon-hash-wasm,
// curve25519-scalarmult-wasm) constructs exactly that at module-eval time
// (reading TextDecoder off require('util')), which throws inside the
// startRailgunEngine require chain before the engine's JS fallback runs.
// Dropping fatal/ignoreBOM is safe: the non-ICU build still decodes UTF-8
// correctly; only those options are unsupported. Must run before engine require.
(function patchTextDecoderForNoICU() {
  try {
    const util = require('util');
    const OrigTextDecoder = util.TextDecoder;
    function PatchedTextDecoder(label, options) {
      if (options && ('fatal' in options || 'ignoreBOM' in options)) {
        const safe = Object.assign({}, options);
        delete safe.fatal;
        delete safe.ignoreBOM;
        return new OrigTextDecoder(label, safe);
      }
      return new OrigTextDecoder(label, options);
    }
    PatchedTextDecoder.prototype = OrigTextDecoder.prototype;
    util.TextDecoder = PatchedTextDecoder;
    if (typeof global !== 'undefined') global.TextDecoder = PatchedTextDecoder;
  } catch (_err) {
    // util always exists in nodejs-mobile.
  }
})();

// nodejs-mobile-react-native injects the 'rn-bridge' module at runtime.
let rnBridge = null;
try {
  // eslint-disable-next-line global-require
  rnBridge = require('rn-bridge');
} catch (_err) {
  // Not running inside nodejs-mobile (e.g. lint/CI). Stay inert.
}

const REQUEST_EVENT = 'rg:request';
const REPLY_EVENT = 'rg:reply';

function reply(id, ok, result, error) {
  if (!rnBridge) return;
  rnBridge.channel.post(REPLY_EVENT, { id: id, ok: ok, result: result, error: error });
}

function emit(event, payload) {
  if (rnBridge) rnBridge.channel.post(event, payload);
}

/* Handlers are filled in by the engine integration commit. Until then every
 * call is answered with a clear "not wired yet" error so the RN side surfaces a
 * friendly message instead of hanging. */
const handlers = Object.create(null);

/* Liveness probe used by the RN side (bridge.pingBridge) to confirm the embedded
 * Node runtime actually booted and the round-trip channel works on this APK.
 * Dependency-free so it works before any engine wiring. Echoes the payload plus
 * the Node version so the on-device test can show what's running. */
handlers['ping'] = function ping(params) {
  return {
    pong: true,
    echo: params == null ? null : params,
    node:
      typeof process !== 'undefined' && process.version
        ? process.version
        : 'unknown',
    at: Date.now(),
  };
};

/* Lazily-loaded RAILGUN engine module. Required on first engine call (not at
 * boot) so a failure to load the heavy native deps surfaces as a bridge error
 * the probe can show, instead of crashing the host before the channel is up. */
let engineMod = null;
function getEngineMod() {
  if (!engineMod) engineMod = require('./engine');
  return engineMod;
}

/* engineStatus: report current engine state WITHOUT forcing init. Cheap probe. */
handlers['engineStatus'] = function engineStatus() {
  try {
    return getEngineMod().status();
  } catch (err) {
    return { ready: false, prover: false, networks: [], error: err && err.message ? err.message : String(err) };
  }
};

/* engineInit: initialize the engine + native prover + providers if needed, then
 * report status. Any failure rejects via dispatch's catch so the probe never
 * hangs and shows a real message. */
handlers['engineInit'] = async function engineInit(params) {
  const mod = getEngineMod();
  emit('event:message', 'Railgun engine init starting…');
  const result = await mod.init(params || {});
  emit('event:message', 'Railgun engine ready ✓');
  return result;
};

/* walletInfo: create-or-load the RAILGUN wallet for the active account (derived
 * deterministically on RN) and return { railgunAddress (0zk…), railgunWalletID }.
 * Inits the engine first if needed. */
handlers['walletInfo'] = async function walletInfo(params) {
  return getEngineMod().walletInfo(params || {});
};

/* balances: trigger a shielded-balance scan for Ethereum + Sepolia and return
 * currently-known per-network ERC20 amounts (+ a `scanning` flag). Non-blocking:
 * returns immediately with whatever the engine already knows. */
handlers['balances'] = async function balances(params) {
  return getEngineMod().balances(params || {});
};

/* ───────────────────────── Generic SDK dispatcher ───────────────────────────
 *
 *  THE generic, future-proof handler. Takes { method, args } and invokes the
 *  matching @railgun-community/wallet operation by name. This is what lets
 *  phases 3-5 (shield / private-transfer / unshield) ship as PURE RN code with
 *  NO further APK rebuild: the multi-step orchestration (estimate → prove →
 *  populate → broadcast) lives in RN and composes these primitives.
 *
 *  Two routing tiers:
 *    1. Stateful ENGINE ops (initEngine / getAddress / balances) → engine.js,
 *       which owns the LevelDB + prover + provider wiring + wallet cache. These
 *       reuse the exact phase-1-2 logic (no behavior change).
 *    2. Everything else → the WHITELIST in sdkDispatch.js (a safe, explicit map
 *       of SDK primitives; NOT arbitrary eval).
 *
 *  STUBS: 'shield' / 'privateTransfer' / 'unshield' are intentionally wired as
 *  not_implemented so the dispatcher SHAPE supports them now; the RN side will
 *  compose them from the whitelisted primitives above without a rebuild. */
let sdkDispatch = null;
function getSdkDispatch() {
  // eslint-disable-next-line global-require
  if (!sdkDispatch) sdkDispatch = require('./sdkDispatch');
  return sdkDispatch;
}

const ENGINE_OPS = Object.create(null);
ENGINE_OPS['initEngine'] = (args) => getEngineMod().init(args[0] || {});
ENGINE_OPS['engineStatus'] = () => getEngineMod().status();
ENGINE_OPS['createWallet'] = (args) => getEngineMod().walletInfo(args[0] || {});
ENGINE_OPS['getAddress'] = (args) => getEngineMod().walletInfo(args[0] || {});
ENGINE_OPS['balances'] = (args) => getEngineMod().balances(args[0] || {});
ENGINE_OPS['listMethods'] = () => getSdkDispatch().listMethods();
const NOT_IMPL = ['shield', 'privateTransfer', 'unshield'];

handlers['sdk'] = async function sdk(params) {
  const method = params && params.method;
  const args = params && Array.isArray(params.args) ? params.args : [];
  if (typeof method !== 'string') throw new Error('sdk requires { method, args }');
  if (NOT_IMPL.indexOf(method) !== -1) {
    const e = new Error('not_implemented: ' + method + ' (compose from whitelisted primitives on RN)');
    e.code = 'not_implemented';
    throw e;
  }
  if (ENGINE_OPS[method]) return ENGINE_OPS[method](args);
  return getSdkDispatch().invoke(method, args);
};

async function dispatch(envelope) {
  if (!envelope || typeof envelope.id !== 'number') return;
  const handler = handlers[envelope.call];
  if (!handler) {
    reply(envelope.id, false, undefined, 'Railgun engine not wired yet: ' + envelope.call);
    return;
  }
  try {
    const result = await handler(envelope.params);
    reply(envelope.id, true, result, undefined);
  } catch (err) {
    reply(envelope.id, false, undefined, err && err.message ? err.message : String(err));
  }
}

if (rnBridge) {
  rnBridge.channel.addListener(REQUEST_EVENT, function onRequest(envelope) {
    void dispatch(envelope);
  });
  emit('event:message', 'Railgun node host booted (scaffold; engine not wired).');
}

// Exposed so engine.js can push diagnostic events ('event:scanDebug', balance
// updates) to the RN debug panel without holding its own rn-bridge handle.
module.exports = { handlers: handlers, emit: emit };
