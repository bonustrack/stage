/* RAILGUN engine bootstrap for the embedded Node host (Milestone 1).
 *
 *  Mirrors RAILGUN Railway-Wallet's mobile/nodejs-src/nodejs-project engine
 *  wiring (node-railgun-engine.ts + node-railgun-artifacts.ts + providers), but
 *  reduced to the "init + load prover + load providers + report ready" scope.
 *  No wallet creation / proving here yet — that is a later milestone.
 *
 *  This file is plain Node CommonJS (NOT React Native / Hermes). The deps are
 *  bundled into the native binary at build time by nodejs-mobile-react-native;
 *  they never enter the Metro graph.
 */
'use strict';

const path = require('path');
const fs = require('fs');

/** Where the engine writes its LevelDB + downloaded circuit artifacts. We keep
 *  it under the Node project dir (writable in the nodejs-mobile sandbox). The RN
 *  side may later pass an explicit app-documents path via engineInit params. */
const DATA_ROOT = path.join(__dirname, 'railgun-data');
const DB_PATH = path.join(DATA_ROOT, 'db');
const ARTIFACTS_DIR = path.join(DATA_ROOT, 'artifacts');

/** Mainnet + Sepolia RPCs. Mirrors apps/app/lib/railgun/networks.ts. Public RPCs
 *  (no key needed for read-only engine polling); swap for keyed endpoints in a
 *  later hardening pass. NetworkName values come from shared-models at runtime. */
const RPC = {
  mainnet: ['https://rpc.brovider.xyz/1', 'https://ethereum-rpc.publicnode.com'],
  sepolia: ['https://rpc.ankr.com/eth_sepolia', 'https://ethereum-sepolia-rpc.publicnode.com'],
};

let state = { ready: false, prover: false, networks: [], version: null, initPromise: null };

function ensureDirs() {
  for (const d of [DATA_ROOT, DB_PATH, ARTIFACTS_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

/** fs-backed ArtifactStore (engine downloads circuit artifacts once, reads back
 *  on later proofs). Identical shape to Railway-Wallet's createArtifactStore. */
function createArtifactStore(ArtifactStore) {
  const abs = (p) => path.join(ARTIFACTS_DIR, p);
  return new ArtifactStore(
    async (p) => fs.promises.readFile(abs(p)),
    async (dir, p, item) => {
      await fs.promises.mkdir(abs(dir), { recursive: true });
      await fs.promises.writeFile(abs(p), item);
    },
    (p) =>
      fs.promises
        .access(abs(p))
        .then(() => true)
        .catch(() => false),
  );
}

/** Load the Groth16 native prover (@railgun-privacy/native-prover) onto the
 *  engine. This is the whole reason the Node host exists — Hermes can't load
 *  this N-API addon. Returns true on success; throws with a clear message so the
 *  probe shows why proving is unavailable on this binary/ABI. */
function wireProver(getProver) {
  // eslint-disable-next-line global-require
  const { nativeProveRailgun, nativeProvePOI, CIRCUITS } = require('@railgun-privacy/native-prover');
  getProver().setNativeProverGroth16(nativeProveRailgun, nativeProvePOI, CIRCUITS);
  return true;
}

/** Load mainnet + Sepolia providers into the engine. Each loadProvider call
 *  returns once the chain's polling provider is connected. Non-fatal per-network
 *  (a dead public RPC shouldn't sink the whole init); we record which loaded. */
async function loadNetworks(sdk, NetworkName) {
  const targets = [
    { net: 'mainnet', chainId: 1, name: NetworkName.Ethereum, urls: RPC.mainnet },
    { net: 'sepolia', chainId: 11155111, name: NetworkName.EthereumSepolia, urls: RPC.sepolia },
  ];
  const loaded = [];
  for (const t of targets) {
    try {
      const cfg = { chainId: t.chainId, providers: t.urls.map((url, i) => ({ provider: url, priority: i + 1, weight: 1 })) };
      // eslint-disable-next-line no-await-in-loop
      await sdk.loadProvider(cfg, t.name, 1000 * 60 * 5);
      loaded.push(t.net);
    } catch (err) {
      // keep going — report only the networks that actually came up
    }
  }
  return loaded;
}

/** Initialize the engine + prover + providers exactly once. Resolves the status
 *  object; on failure rejects with a real Error so engineStatus reports it. */
async function init(params) {
  if (state.ready) return status();
  if (state.initPromise) return state.initPromise;
  state.initPromise = (async () => {
    ensureDirs();
    // eslint-disable-next-line global-require
    const sdk = require('@railgun-community/wallet');
    // eslint-disable-next-line global-require
    const shared = require('@railgun-community/shared-models');
    // eslint-disable-next-line global-require
    const LeveldownNodejsMobile = require('leveldown-nodejs-mobile');

    const lock = path.join(DB_PATH, 'LOCK');
    if (fs.existsSync(lock)) {
      try { fs.unlinkSync(lock); } catch (_e) { /* ignore stale-lock cleanup */ }
    }
    const db = new LeveldownNodejsMobile(DB_PATH);
    const dev = !!(params && params.dev);
    await sdk.startRailgunEngine(
      (params && params.walletSource) || 'metro',
      db,
      dev, // shouldDebug
      createArtifactStore(sdk.ArtifactStore),
      true, // useNativeArtifacts
      false, // skipMerkletreeScans
      undefined, // poiNodeURLs (SDK defaults)
      undefined, // customPOILists
    );
    state.prover = wireProver(sdk.getProver);
    state.networks = await loadNetworks(sdk, shared.NetworkName);
    state.version =
      (shared.RAILGUN_VERSION && String(shared.RAILGUN_VERSION)) ||
      tryPkgVersion('@railgun-community/wallet');
    state.ready = true;
    return status();
  })();
  try {
    return await state.initPromise;
  } catch (err) {
    state.initPromise = null; // allow retry
    throw err;
  }
}

function tryPkgVersion(name) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(name + '/package.json').version || null;
  } catch (_e) {
    return null;
  }
}

function status() {
  return {
    ready: state.ready,
    prover: state.prover,
    networks: state.networks,
    version: state.version,
    dbPath: DB_PATH,
  };
}

module.exports = { init, status };
