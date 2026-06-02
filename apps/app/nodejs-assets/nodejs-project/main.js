/* RAILGUN engine + Groth16 prover host — runs inside nodejs-mobile-react-native.
 *
 *  WHY THIS FILE EXISTS: the on-device Groth16 prover (@railgun-privacy/native-
 *  prover) is a Node N-API `.node` addon that Hermes cannot load. The ONLY way
 *  to generate proofs on-device is to run the whole RAILGUN engine inside a real
 *  embedded Node runtime (this process) and talk to it from RN over the
 *  nodejs-mobile message channel. This mirrors RAILGUN's reference app
 *  (Railway-Wallet, mobile/nodejs-src/nodejs-project/src/main.ts).
 *
 *  STATUS: SCAFFOLD ONLY. This boot file is intentionally dependency-free so it
 *  is safely committable and does nothing harmful if the runtime is ever started
 *  before the engine deps are installed. The real engine wiring (the imports
 *  listed in NEXT STEPS below) is added in the follow-up commit that also adds
 *  the node deps + the nodejs-mobile-react-native RN dep + the new APK build.
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
  rnBridge.channel.send(REPLY_EVENT, { id: id, ok: ok, result: result, error: error });
}

function emit(event, payload) {
  if (rnBridge) rnBridge.channel.send(event, payload);
}

/* Handlers are filled in by the engine integration commit. Until then every
 * call is answered with a clear "not wired yet" error so the RN side surfaces a
 * friendly message instead of hanging. */
const handlers = Object.create(null);

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

module.exports = { handlers: handlers };
