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

/** Push a diagnostic event to the RN debug panel. main.js owns the rn-bridge
 *  channel; we lazily grab its `emit` so engine.js stays import-safe in CI/lint
 *  (where rn-bridge is absent). Falls back to a no-op + console. */
let _emit = null;
function emit(event, payload) {
  try {
    if (!_emit) {
      // eslint-disable-next-line global-require
      const main = require('./main');
      _emit = (main && main.emit) || function () {};
    }
    _emit(event, payload);
  } catch (_e) {
    /* never let diagnostics throw */
  }
}

/** Ring buffer of scan diagnostics, surfaced via engineStatus().scanDebug and
 *  pushed live as 'event:scanDebug'. Each entry: { t, chain, msg }. Capped. */
const scanLog = [];
function scanDebug(chainId, msg) {
  const entry = { t: Date.now(), chain: chainId, msg: String(msg) };
  scanLog.push(entry);
  if (scanLog.length > 80) scanLog.shift();
  emit('event:scanDebug', entry);
}

/** Where the engine writes its LevelDB + downloaded circuit artifacts. We keep
 *  it under the Node project dir (writable in the nodejs-mobile sandbox). The RN
 *  side may later pass an explicit app-documents path via engineInit params. */
const DATA_ROOT = path.join(__dirname, 'railgun-data');
const DB_PATH = path.join(DATA_ROOT, 'db');
const ARTIFACTS_DIR = path.join(DATA_ROOT, 'artifacts');

/** Mainnet + Sepolia RPCs. Mirrors apps/app/lib/railgun/networks.ts. Public RPCs
 *  (no key needed for read-only engine polling); swap for keyed endpoints in a
 *  later hardening pass. NetworkName values come from shared-models at runtime. */
/* getLogs-capable public RPCs ONLY — the merkletree scan does eth_getLogs over
 * the RailgunSmartWallet address, and a non-getLogs proxy (e.g. brovider, ankr)
 * silently fails the scan → no commitment found → balance stays 0. These mirror
 * the vetted list in apps/app/lib/railgun/networks.ts. Need >= 2 per net for the
 * SDK's fallback-provider quorum. */
const RPC = {
  mainnet: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
  sepolia: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.drpc.org'],
};

/** Private Proof of Innocence aggregator node(s). REQUIRED at engine start for
 *  any network whose NETWORK_CONFIG defines `poi` (Sepolia + mainnet do) — else
 *  loadProvider throws "This network requires Proof Of Innocence. Pass
 *  poiNodeURL to startRailgunEngine...". This is the public aggregator from the
 *  RAILGUN developer guide; passing it makes WalletPOI.started true so shield
 *  populate/provider-load succeeds. Order = priority (fallback on failure). */
const POI_NODE_URLS = ['https://ppoi-agg.horsewithsixlegs.xyz'];

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
      scanDebug(t.chainId, 'provider loaded ✓ (' + t.net + ' rpcs: ' + t.urls.join(', ') + ')');
    } catch (err) {
      scanDebug(t.chainId, 'provider load FAILED (' + t.net + '): ' + (err && err.message ? err.message : String(err)));
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
      POI_NODE_URLS, // poiNodeURLs — REQUIRED (Sepolia/mainnet define NETWORK_CONFIG.poi)
      undefined, // customPOILists
    );
    // Surface the engine's own UTXO merkletree scan lifecycle (Started/Updated/
    // Complete/Incomplete + progress) to the RN debug panel. This is the DECISIVE
    // signal: if the scan reaches Complete but no balanceUpdate ever fires with
    // rows, the tree genuinely held zero commitments for this wallet/chain.
    try {
      if (sdk.setOnUTXOMerkletreeScanCallback) {
        sdk.setOnUTXOMerkletreeScanCallback(function onUTXOScan(d) {
          try {
            scanDebug(d.chain && d.chain.id, 'UTXO scan ' + d.scanStatus + ' (' + Math.round((d.progress || 0) * 100) + '%)');
          } catch (_e) { /* ignore */ }
        });
      }
      if (sdk.setOnTXIDMerkletreeScanCallback) {
        sdk.setOnTXIDMerkletreeScanCallback(function onTXIDScan(d) {
          try {
            scanDebug(d.chain && d.chain.id, 'TXID scan ' + d.scanStatus + ' (' + Math.round((d.progress || 0) * 100) + '%)');
          } catch (_e) { /* ignore */ }
        });
      }
    } catch (_e) { /* scan callbacks are best-effort instrumentation */ }
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

/* ───────────────────────── Wallet + balances (phase 1-2) ─────────────────────
 *
 *  walletInfo: create-or-load the RAILGUN wallet for the active account and
 *  return its { railgunAddress (0zk…), railgunWalletID }. Determinism lives on
 *  the RN side (lib/railgun/deriveKeys.ts): the SAME EOA private key always maps
 *  to the SAME { encryptionKey, mnemonic }, and createRailgunWallet is itself
 *  deterministic in the mnemonic, so the 0zk address is stable across launches.
 *  We memoize the loaded wallet id per encryptionKey+mnemonic so repeat calls
 *  are cheap (createRailgunWallet is idempotent but does disk work).
 *
 *  balances: trigger a Merkle-tree scan (refreshBalances) for Ethereum +
 *  Sepolia and return whatever shielded ERC20 amounts are CURRENTLY known. The
 *  scan is async (the engine walks the tree in the background and emits via the
 *  balance-update callback we register once); we never block on a full scan — we
 *  return the latest cached amounts plus a `scanning` flag so the UI shows an
 *  empty/$0 state immediately and fills in as the callback lands. */

let walletCacheKey = null; // `${encryptionKey}:${mnemonic}` of the loaded wallet
let walletCacheId = null;

/** Latest shielded ERC20 balances by `${chainId}:${walletID}:${bucket}` →
 *  [{tokenAddress, amount(decimal string)}]. Populated by the balance-update
 *  callback the engine fires after a scan; summed across owned buckets by the
 *  `balances` handler.
 *
 *  WHY PER-BUCKET: when POI is REQUIRED for a network (it is for BOTH mainnet
 *  AND Sepolia — see shared-models NETWORK_CONFIG[...].poi.launchBlock, already
 *  in the past), the SDK's onBalancesUpdate fires the callback ONCE PER
 *  RailgunWalletBalanceBucket (Spendable / ShieldPending / ShieldBlocked / …).
 *  A freshly-shielded note starts in `ShieldPending` and only moves to
 *  `Spendable` after the POI aggregator validates it — which may NEVER happen on
 *  Sepolia (mainnet aggregators don't cover testnets). The old code keyed the
 *  cache by chain+wallet only, so each bucket event CLOBBERED the previous one;
 *  whichever fired last won — typically the empty `Spendable` bucket → balance
 *  shows 0 forever even though the shield succeeded on-chain.
 *
 *  FIX: store each bucket separately and SUM all "owned" buckets (everything
 *  except `Spent`) for display, so a shielded note appears immediately
 *  regardless of POI status. */
const balanceCache = new Map();
let balanceCallbackWired = false;

/** Buckets whose notes the wallet still OWNS (should count toward the displayed
 *  shielded balance). Excludes `Spent` (already unshielded / sent out). */
const OWNED_BUCKETS = [
  'Spendable', 'ShieldPending', 'ShieldBlocked',
  'ProofSubmitted', 'MissingInternalPOI', 'MissingExternalPOI',
];

function bucketKey(chainId, walletId, bucket) {
  return chainId + ':' + walletId + ':' + (bucket || 'Spendable');
}

/** Sum every owned bucket for a chain+wallet into one tokenAddress→amount list.
 *  Read synchronously by the `balances` handler. */
function summedRows(chainId, walletId) {
  const totals = new Map(); // lowercased addr → bigint
  for (const bucket of OWNED_BUCKETS) {
    const rows = balanceCache.get(bucketKey(chainId, walletId, bucket));
    if (!rows) continue;
    for (const r of rows) {
      const k = r.tokenAddress.toLowerCase();
      let cur = totals.get(k) || 0n;
      try { cur += BigInt(r.amount); } catch (_e) { /* skip malformed */ }
      totals.set(k, cur);
    }
  }
  const out = [];
  totals.forEach((amount, tokenAddress) => {
    if (amount > 0n) out.push({ tokenAddress: tokenAddress, amount: amount.toString() });
  });
  return out;
}

/** Register the engine's balance-update callback ONCE so background scans keep
 *  balanceCache fresh. RailgunBalancesEvent: { chain:{type,id}, railgunWalletID,
 *  erc20Amounts:[{tokenAddress, amount:bigint}], balanceBucket }. Stored
 *  per-bucket (see balanceCache doc) so POI-pending notes aren't clobbered. */
function wireBalanceCallback(sdk) {
  if (balanceCallbackWired) return;
  balanceCallbackWired = true;
  sdk.setOnBalanceUpdateCallback(function onBalances(ev) {
    try {
      const rows = (ev.erc20Amounts || []).map((a) => ({
        tokenAddress: a.tokenAddress,
        amount: a.amount == null ? '0' : a.amount.toString(),
      }));
      balanceCache.set(bucketKey(ev.chain.id, ev.railgunWalletID, ev.balanceBucket), rows);
      const summed = summedRows(ev.chain.id, ev.railgunWalletID);
      scanDebug(
        ev.chain.id,
        'balanceUpdate bucket=' + ev.balanceBucket + ' wallet=' + String(ev.railgunWalletID).slice(0, 10) +
          ' rows=' + rows.length + ' summedOwned=' + summed.length,
      );
      emit('event:balanceUpdate', { chainId: ev.chain.id, walletId: ev.railgunWalletID, rows: summed });
    } catch (_e) {
      /* never let a malformed event sink the callback */
    }
  });
}

/** Create-or-load the wallet for the supplied (deterministic) key material. */
async function walletInfo(params) {
  if (!state.ready) await init(params || {});
  // eslint-disable-next-line global-require
  const sdk = require('@railgun-community/wallet');
  wireBalanceCallback(sdk);

  const encryptionKey = params && params.encryptionKey;
  const mnemonic = params && params.mnemonic;
  if (!encryptionKey || !mnemonic) {
    throw new Error('walletInfo requires { encryptionKey, mnemonic }');
  }
  const creationBlocks = (params && params.creationBlocks) || undefined;

  const key = encryptionKey + ':' + mnemonic;
  if (walletCacheKey === key && walletCacheId) {
    return { railgunWalletID: walletCacheId, railgunAddress: sdk.getRailgunAddress(walletCacheId) || '' };
  }
  const info = await sdk.createRailgunWallet(encryptionKey, mnemonic, creationBlocks);
  walletCacheKey = key;
  walletCacheId = info.id;
  scanDebug(0, 'wallet loaded id=' + String(info.id).slice(0, 14) + ' addr=' + String(info.railgunAddress).slice(0, 12) + '… creationBlocks=' + JSON.stringify(creationBlocks || {}));
  return { railgunWalletID: info.id, railgunAddress: info.railgunAddress };
}

/** Chains for which we've already kicked the one-time FULL on-chain UTXO scan
 *  (rescanFullUTXOMerkletreesAndWallets). Keyed `${chainId}:${walletId}`. */
const fullScanKicked = new Set();

/** Walk the chain logs + (re)build the UTXO merkletree for a wallet, in the
 *  BACKGROUND. THE ROOT-CAUSE FIX: `refreshBalances` only re-DERIVES balances
 *  from the merkletree the engine ALREADY has on disk — on a cold wallet that
 *  tree was never synced, so it's empty and balances are always 0. The actual
 *  on-chain eth_getLogs scan that POPULATES the tree is
 *  `rescanFullUTXOMerkletreesAndWallets`. We run it ONCE per chain+wallet (it's
 *  expensive), then rely on `refreshBalances` for cheap subsequent reads. The
 *  scan callbacks (init) + balanceUpdate logging make the result visible. */
function kickFullScan(sdk, chain, walletId) {
  const k = chain.id + ':' + walletId;
  if (fullScanKicked.has(k)) {
    // Cheap re-derive from the already-synced tree.
    Promise.resolve(sdk.refreshBalances(chain, [walletId])).catch((e) =>
      scanDebug(chain.id, 'refreshBalances error: ' + (e && e.message ? e.message : String(e))),
    );
    return;
  }
  fullScanKicked.add(k);
  scanDebug(chain.id, 'full UTXO rescan START wallet=' + String(walletId).slice(0, 10));
  Promise.resolve()
    .then(() => {
      if (typeof sdk.rescanFullUTXOMerkletreesAndWallets === 'function') {
        return sdk.rescanFullUTXOMerkletreesAndWallets(chain, [walletId]);
      }
      return sdk.refreshBalances(chain, [walletId]);
    })
    .then(() => {
      scanDebug(chain.id, 'full UTXO rescan DONE wallet=' + String(walletId).slice(0, 10));
      // After the tree is synced, derive balances (fires balanceUpdate).
      return sdk.refreshBalances(chain, [walletId]);
    })
    .catch((e) => {
      // CRITICAL: don't swallow — this is the message that explains a 0 balance.
      fullScanKicked.delete(k); // allow a retry next refresh
      scanDebug(chain.id, 'full UTXO rescan ERROR: ' + (e && e.message ? e.message : String(e)));
    });
}

/** Trigger a scan for both networks and return currently-known balances. */
async function balances(params) {
  if (!state.ready) await init(params || {});
  // eslint-disable-next-line global-require
  const sdk = require('@railgun-community/wallet');
  // eslint-disable-next-line global-require
  const shared = require('@railgun-community/shared-models');
  wireBalanceCallback(sdk);

  const walletId = params && params.walletId;
  if (!walletId) throw new Error('balances requires { walletId }');
  scanDebug(0, 'balances() called wallet=' + String(walletId).slice(0, 14) + ' loadedNets=[' + state.networks.join(',') + ']');

  // ChainType.EVM === 0; ids: Ethereum=1, Sepolia=11155111.
  const targets = [
    { net: 'mainnet', chainId: 1 },
    { net: 'sepolia', chainId: 11155111 },
  ];
  let scanning = false;
  const networks = {};
  for (const t of targets) {
    const chain = { type: shared.ChainType ? shared.ChainType.EVM : 0, id: t.chainId };
    try {
      // Kick the real on-chain scan in the background (full sync once, then
      // cheap re-derive). The balanceUpdate callback fills the cache + the panel
      // shows the scan lifecycle, so we still return promptly.
      kickFullScan(sdk, chain, walletId);
      scanning = true;
    } catch (e) {
      scanDebug(t.chainId, 'scan kick FAILED (' + t.net + '): ' + (e && e.message ? e.message : String(e)));
    }
    networks[t.net] = summedRows(t.chainId, walletId);
  }
  return { walletId: walletId, networks: networks, scanning: scanning, scanDebug: scanLog.slice(-40) };
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
    scanDebug: scanLog.slice(-40),
  };
}

module.exports = { init, status, walletInfo, balances };
