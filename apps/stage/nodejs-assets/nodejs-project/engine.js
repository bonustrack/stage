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
/* ───────────────────────── RUNTIME SCAN CONFIG ───────────────────────────────
 *
 *  Phase 1: the scan/RPC policy (RPC urls, per-chain enable, batch size, stall +
 *  attempt timeouts, heartbeat cadence) is now PASSED FROM RN at engineInit
 *  (params.scanConfig - see apps/app/lib/railgun/bridge/scanConfig.ts) instead of
 *  living as hardcoded consts here. The DEFAULTS below mirror the previous
 *  hardcoded values 1:1, so omitting scanConfig is behavior-identical. applyScan
 *  Config() overlays whatever RN sent over these defaults at init time. */
const DEFAULT_CFG = {
  rpc: {
    mainnet: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
    sepolia: [
      // Keyed dRPC Sepolia endpoint (PRIMARY) - reliably serves eth_getLogs so the
      // RAILGUN merkletree historical-events scan completes (public RPCs stalled at
      // the getLogs step → empty tree → $0 shielded balance). Public node kept as
      // secondary fallback for the SDK's fallback-provider quorum.
      'https://lb.drpc.org/ogrpc?network=sepolia&dkey=AqrKBDkAZkycokrrHI5M--EgA5HAYAQR8ZoW7sA_udJz',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
    ],
  },
  // Sepolia ONLY (mainnet getLogs failures grab the global rescan lock + wedge
  // Sepolia at 50% - see SCAN_CHAIN_IDS doc below).
  scanChainIds: [11155111],
  maxLogsPerBatch: 1,
  stallTimeoutMs: 5000,
  scanAttemptTimeoutMs: 90 * 1000,
  scanMaxAttempts: 4,
  heartbeatIntervalMs: 5000,
};

/** Live config, mutated once by applyScanConfig() at init. Starts as defaults so
 *  anything reading it before init still sees identical behavior. */
const cfg = {
  rpc: { mainnet: DEFAULT_CFG.rpc.mainnet.slice(), sepolia: DEFAULT_CFG.rpc.sepolia.slice() },
  scanChainIds: new Set(DEFAULT_CFG.scanChainIds),
  maxLogsPerBatch: DEFAULT_CFG.maxLogsPerBatch,
  stallTimeoutMs: DEFAULT_CFG.stallTimeoutMs,
  scanAttemptTimeoutMs: DEFAULT_CFG.scanAttemptTimeoutMs,
  scanMaxAttempts: DEFAULT_CFG.scanMaxAttempts,
  heartbeatIntervalMs: DEFAULT_CFG.heartbeatIntervalMs,
};

/** Overlay the RN-supplied scanConfig onto `cfg`. Every field is optional; a
 *  missing field keeps the default. `chains[].enabled` drives scanChainIds and
 *  per-net RPC urls. Tolerant of malformed input (keeps defaults on any error). */
function applyScanConfig(sc) {
  if (!sc || typeof sc !== 'object') return;
  try {
    if (Array.isArray(sc.chains)) {
      const ids = new Set();
      for (const c of sc.chains) {
        if (!c || typeof c.chainId !== 'number') continue;
        if (c.enabled) ids.add(c.chainId);
        if (Array.isArray(c.rpcUrls) && c.rpcUrls.length && (c.net === 'mainnet' || c.net === 'sepolia')) {
          cfg.rpc[c.net] = c.rpcUrls.slice();
        }
      }
      if (ids.size) cfg.scanChainIds = ids;
    }
    if (Number.isFinite(sc.maxLogsPerBatch)) cfg.maxLogsPerBatch = sc.maxLogsPerBatch;
    if (Number.isFinite(sc.stallTimeoutMs)) cfg.stallTimeoutMs = sc.stallTimeoutMs;
    if (Number.isFinite(sc.scanAttemptTimeoutMs)) cfg.scanAttemptTimeoutMs = sc.scanAttemptTimeoutMs;
    if (Number.isFinite(sc.scanMaxAttempts)) cfg.scanMaxAttempts = sc.scanMaxAttempts;
    if (Number.isFinite(sc.heartbeatIntervalMs)) cfg.heartbeatIntervalMs = sc.heartbeatIntervalMs;
    scanDebug(0, 'scanConfig applied: scanChains=[' + Array.from(cfg.scanChainIds).join(',') +
      '] maxLogsPerBatch=' + cfg.maxLogsPerBatch + ' stall=' + cfg.stallTimeoutMs +
      ' attemptTimeout=' + cfg.scanAttemptTimeoutMs + ' maxAttempts=' + cfg.scanMaxAttempts +
      ' heartbeat=' + cfg.heartbeatIntervalMs);
  } catch (e) {
    scanDebug(0, 'scanConfig apply error (using defaults): ' + (e && e.message ? e.message : String(e)));
  }
}

/** Per-provider getLogs/JSON-RPC tuning (from fix/railgun-scan-chunk).
 *
 *  WHY: the engine's UTXO merkletree scan walks the RailgunSmartWallet logs in
 *  499-block chunks via an UNFILTERED `queryFilter('*', from, to)`. Each chunk
 *  has a 5s timeout and retries up to 30× on timeout. Public Sepolia RPCs choke
 *  on unfiltered `*` getLogs *batched together* over JSON-RPC, so every chunk
 *  burns ~150s of silent retries → the scan freezes ("stuck at 50%").
 *
 *  FIX: `maxLogsPerBatch` maps to ethers' `batchMaxCount` on the underlying
 *  JsonRpcProvider. Setting it to 1 DISABLES JSON-RPC request batching, so each
 *  getLogs goes out as its own HTTP request — far more reliable on rate-limited
 *  public testnet RPCs. `stallTimeout` lets the fallback provider fail over.
 *  Both are now runtime-tunable via cfg.maxLogsPerBatch / cfg.stallTimeoutMs. */

/** Private Proof of Innocence aggregator node(s). REQUIRED at engine start for
 *  any network whose NETWORK_CONFIG defines `poi` (Sepolia + mainnet do) — else
 *  loadProvider throws "This network requires Proof Of Innocence. Pass
 *  poiNodeURL to startRailgunEngine...". This is the public aggregator from the
 *  RAILGUN developer guide; passing it makes WalletPOI.started true so shield
 *  populate/provider-load succeeds. Order = priority (fallback on failure). */
const POI_NODE_URLS = ['https://ppoi-agg.horsewithsixlegs.xyz'];

/** CHAINS WE ACTUALLY SCAN FOR BALANCES. The user shields on Sepolia only.
 *  CRITICAL (fix/railgun-rescan-lock): the engine's
 *  fullRescanUTXOMerkletreesAndWallets takes ONE GLOBAL rescan lock. If we kick a
 *  rescan for mainnet (chainId 1), its eth_getLogs scan fails+retries forever
 *  ("Scan query error … Retrying 29 times" / "Failed to scan V2 events") while
 *  HOLDING that lock — so every subsequent Sepolia rescan returns "Full rescan
 *  already in progress" and Sepolia parks at 50% (merkletree done, wallet-decrypt
 *  phase 2 never starts). We therefore DO NOT scan mainnet at all. Add chainId 1
 *  back here only once a mainnet RPC + scan-range is proven not to wedge.
 *  RUNTIME: now driven by cfg.scanChainIds (set from RN scanConfig). */

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
    { net: 'mainnet', chainId: 1, name: NetworkName.Ethereum, urls: cfg.rpc.mainnet },
    { net: 'sepolia', chainId: 11155111, name: NetworkName.EthereumSepolia, urls: cfg.rpc.sepolia },
  ];
  const loaded = [];
  for (const t of targets) {
    // Only load providers for chains we actually scan (Sepolia). Loading the
    // mainnet provider is pointless if we never scan it, and its getLogs failures
    // just spam the log — skip it entirely.
    if (!cfg.scanChainIds.has(t.chainId)) {
      scanDebug(t.chainId, 'provider load SKIPPED (' + t.net + ') - not in scanChainIds');
      // eslint-disable-next-line no-continue
      continue;
    }
    try {
      const providerConfig = {
        chainId: t.chainId,
        providers: t.urls.map((url, i) => ({
          provider: url,
          priority: i + 1,
          weight: 1,
          stallTimeout: cfg.stallTimeoutMs,
          maxLogsPerBatch: cfg.maxLogsPerBatch,
        })),
      };
      // eslint-disable-next-line no-await-in-loop
      await sdk.loadProvider(providerConfig, t.name, 1000 * 60 * 5);
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
  // Overlay RN-supplied scan/RPC config (behavior-identical when omitted) BEFORE
  // we load providers or start the heartbeat, so both see the final policy.
  applyScanConfig(params && params.scanConfig);
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
    // shouldDebug MUST be true for the engine to forward its internal scan logs
    // (per-getLogs-chunk ranges + RPC errors) to our setLoggers handler below.
    // verboseScanLogging (9th arg) is also gated on this. We force it on so the
    // scan diagnostics reach the RN debug panel.
    await sdk.startRailgunEngine(
      (params && params.walletSource) || 'metro',
      db,
      true, // shouldDebug — REQUIRED so engine scan/getLogs logs reach setLoggers
      createArtifactStore(sdk.ArtifactStore),
      true, // useNativeArtifacts
      false, // skipMerkletreeScans
      POI_NODE_URLS, // poiNodeURLs — REQUIRED (Sepolia/mainnet define NETWORK_CONFIG.poi)
      undefined, // customPOILists
      true, // verboseScanLogging — emit per-chunk "Scanning historical events from block X to Y"
    );
    // ROOT-CAUSE FIX (issue #261): startRailgunEngine hardcodes the graphql-mesh
    // quick-sync, which throws inside nodejs-mobile ("Failed to quick sync" /
    // "Failed to sync Railgun transactions V2") and forces a ~25k-call eth_getLogs
    // slow scan that stalls -> balances stay 0. Swap ONLY the transport to a plain
    // https POST (reusing the SDK's own GraphQL documents + formatters) so the fast
    // subgraph path works on-device. Non-fatal: if patching fails we keep the SDK
    // default (and the existing full-rescan fallback in kickFullScan).
    try {
      // eslint-disable-next-line global-require
      const { installRawHttpQuickSync } = require('./quicksync');
      installRawHttpQuickSync(sdk, scanDebug);
    } catch (e) {
      scanDebug(0, 'rawQuickSync install error (using SDK default): ' + (e && e.message ? e.message : String(e)));
    }
    // Surface the engine's own UTXO merkletree scan lifecycle (Started/Updated/
    // Complete/Incomplete + progress) to the RN debug panel. This is the DECISIVE
    // signal: if the scan reaches Complete but no balanceUpdate ever fires with
    // rows, the tree genuinely held zero commitments for this wallet/chain.
    try {
      if (sdk.setOnUTXOMerkletreeScanCallback) {
        sdk.setOnUTXOMerkletreeScanCallback(function onUTXOScan(d) {
          try {
            markScanProgress(d.chain && d.chain.id);
            scanDebug(d.chain && d.chain.id, 'UTXO scan ' + d.scanStatus + ' (' + Math.round((d.progress || 0) * 100) + '%)');
          } catch (_e) { /* ignore */ }
        });
      }
      if (sdk.setOnTXIDMerkletreeScanCallback) {
        sdk.setOnTXIDMerkletreeScanCallback(function onTXIDScan(d) {
          try {
            markScanProgress(d.chain && d.chain.id);
            scanDebug(d.chain && d.chain.id, 'TXID scan ' + d.scanStatus + ' (' + Math.round((d.progress || 0) * 100) + '%)');
          } catch (_e) { /* ignore */ }
        });
      }
    } catch (_e) { /* scan callbacks are best-effort instrumentation */ }
    // Forward the engine's INTERNAL debug logs (which include the per-getLogs-
    // chunk scan ranges + RPC errors) into the scanDebug ring buffer. Without
    // this, the wallet SDK swallows every "Scanning historical events from block
    // X to Y", "Scan query error at block X. Retrying N times", and "Scan failed
    // at block X" message — leaving only the useless "50%" progress spam. We
    // filter to scan/log/provider-relevant lines so the panel isn't flooded.
    // (from fix/railgun-scan-chunk: verboseScanLogging + SCAN_RE filter.)
    try {
      if (sdk.setLoggers) {
        const SCAN_RE = /scan|block|getlogs|provider|merkle|quicksync|nullifier|commitment|shield|retry|fail|error/i;
        sdk.setLoggers(
          function engineLog(msg) {
            const s = String(msg);
            if (SCAN_RE.test(s)) scanDebug(-1, 'engine: ' + s.slice(0, 300));
          },
          function engineErr(err) {
            const s = err && err.message ? err.message : String(err);
            scanDebug(-1, 'engineERR: ' + s.slice(0, 300));
          },
        );
      }
    } catch (_e) { /* logger wiring is best-effort */ }
    state.prover = wireProver(sdk.getProver);
    state.networks = await loadNetworks(sdk, shared.NetworkName);
    state.version =
      (shared.RAILGUN_VERSION && String(shared.RAILGUN_VERSION)) ||
      tryPkgVersion('@railgun-community/wallet');
    state.ready = true;
    startHeartbeat();
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
      markScanProgress(ev.chain && ev.chain.id);
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

/* ──────────────────────────── SCAN SERIALIZATION ────────────────────────────
 *
 *  vc23 BUG: two near-simultaneous balances() pongs (ids 28/29) BOTH kicked
 *  `rescanFullUTXOMerkletreesAndWallets` on the Sepolia wallet. The engine holds
 *  ONE global rescan lock, so the second call threw "Full rescan already in
 *  progress" — and the getLogs walk froze on the first 10k-event batch (block
 *  5784866) at 50%, never advancing. Balance stayed 0.
 *
 *  vc24 FIX — three parts:
 *   1. TRUE MUTEX: one in-flight scan promise PER chain+wallet (scanInFlight). A
 *      duplicate balances() call RETURNS the existing promise (await/no-op) — it
 *      never starts a second scan and never throws.
 *   2. INCREMENTAL by default: use `refreshBalances` (→ engine.scanContractHistory,
 *      which RESUMES from lastSyncedBlock) instead of the full rescan on every
 *      load. The full rescan restarts the whole getLogs walk from genesis and is
 *      what collided + stalled. A full rescan is used ONLY as an explicit
 *      fallback (forceFullRescan, or last attempt on a never-completed
 *      cold/corrupt tree).
 *   3. getLogs HANG → TIMEOUT + RETRY: wrap each scan attempt in a timeout. If a
 *      historical-events batch hangs (the dRPC should serve it, but a single
 *      range can stall), the attempt is abandoned and re-kicked with backoff.
 *      Because the scan is INCREMENTAL it resumes past the ranges it already
 *      ingested, so a hung first range is retried rather than freezing at 50%. */

/** In-flight scan promise per `${chainId}:${walletId}`. Presence == a scan is
 *  running; concurrent callers await it instead of kicking a second (the mutex). */
const scanInFlight = new Map();
/** chain+wallet keys that have completed >=1 successful scan (tree populated). */
const scanCompleted = new Set();

/** ms before a single scan attempt is considered hung and retried. The dRPC
 *  Sepolia getLogs walk completes well inside this; a stuck batch will not.
 *  RUNTIME: cfg.scanAttemptTimeoutMs / cfg.scanMaxAttempts (from RN scanConfig). */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ───────────────────────────── STATUS HEARTBEAT ──────────────────────────────
 *
 *  Phase 1: a fixed-cadence 'event:heartbeat' lets the RN side detect a stalled
 *  scan and kick it (balances forceFullRescan). We track per-chain scan liveness:
 *  `scanning` = a scan is in flight, `lastProgressAt` = last UTXO/TXID merkletree
 *  progress callback or balanceUpdate, `stalled` = scanning but no progress for
 *  > 2x the attempt timeout. lastProgressAt is bumped by markScanProgress(), wired
 *  into the existing scan callbacks (no behavior change to the scan itself). */
const chainProgress = new Map(); // chainId → last-progress epoch ms
let heartbeatTimer = null;

function markScanProgress(chainId) {
  if (chainId != null && chainId !== -1) chainProgress.set(chainId, Date.now());
}

function buildHeartbeatChains() {
  const out = {};
  const scanningChains = new Set();
  scanInFlight.forEach((_p, k) => {
    const id = Number(String(k).split(':')[0]);
    if (Number.isFinite(id)) scanningChains.add(id);
  });
  const stalledAfter = cfg.scanAttemptTimeoutMs * 2;
  cfg.scanChainIds.forEach((id) => {
    const scanning = scanningChains.has(id);
    const last = chainProgress.has(id) ? chainProgress.get(id) : null;
    const stalled = scanning && last != null && Date.now() - last > stalledAfter;
    out[String(id)] = { scanning: scanning, lastProgressAt: last, stalled: stalled };
  });
  return out;
}

function startHeartbeat() {
  if (heartbeatTimer || !cfg.heartbeatIntervalMs) return;
  heartbeatTimer = setInterval(() => {
    try {
      emit('event:heartbeat', { at: Date.now(), ready: state.ready, chains: buildHeartbeatChains() });
    } catch (_e) { /* never let the heartbeat throw */ }
  }, cfg.heartbeatIntervalMs);
  if (heartbeatTimer && typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();
}

/** Race a scan attempt against a timeout. The underlying engine scan keeps
 *  running on timeout (we can't cancel it), but the next attempt is INCREMENTAL
 *  and resumes from the furthest synced block — so a hung range is effectively
 *  retried rather than wedging the whole walk at 50%. */
function withTimeout(promise, ms, label) {
  let to;
  const timeout = new Promise((_resolve, reject) => {
    to = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(to));
}

/** Run a scan for one chain+wallet, with timeout + backoff retry, serialized via
 *  scanInFlight so a duplicate balances() call awaits this SAME promise instead
 *  of starting a second scan. Incremental by default (refreshBalances →
 *  scanContractHistory); escalates to a ONE-SHOT full rescan only if forced, or
 *  on the last attempt for a chain that has NEVER completed (cold/corrupt tree).
 *  Returns the in-flight promise. */
function runSerializedScan(sdk, chain, walletId, opts) {
  const k = chain.id + ':' + walletId;
  const existing = scanInFlight.get(k);
  if (existing) {
    scanDebug(chain.id, 'scan already in flight wallet=' + String(walletId).slice(0, 10) + ' — awaiting existing (NO second kick)');
    return existing;
  }
  const forceFull = !!(opts && opts.forceFullRescan);

  const maxAttempts = cfg.scanMaxAttempts;
  const p = (async () => {
    markScanProgress(chain.id); // a scan is starting → reset the stall clock
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const useFull = (forceFull && attempt === 1) ||
        (attempt === maxAttempts && !scanCompleted.has(k) &&
         typeof sdk.rescanFullUTXOMerkletreesAndWallets === 'function');
      const kind = useFull ? 'FULL rescan' : 'incremental scan';
      scanDebug(chain.id, kind + ' START (attempt ' + attempt + '/' + maxAttempts + ') wallet=' + String(walletId).slice(0, 10));
      try {
        const call = useFull
          ? sdk.rescanFullUTXOMerkletreesAndWallets(chain, [walletId])
          : sdk.refreshBalances(chain, [walletId]);
        // eslint-disable-next-line no-await-in-loop
        await withTimeout(Promise.resolve(call), cfg.scanAttemptTimeoutMs, kind);
        scanCompleted.add(k);
        markScanProgress(chain.id);
        scanDebug(chain.id, kind + ' DONE wallet=' + String(walletId).slice(0, 10));
        return;
      } catch (e) {
        lastErr = e;
        const msg = e && e.message ? e.message : String(e);
        scanDebug(chain.id, kind + ' attempt ' + attempt + ' FAILED: ' + msg.slice(0, 200));
        if (attempt < maxAttempts) {
          const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
          scanDebug(chain.id, 'retrying scan in ' + backoff + 'ms (incremental resumes from last synced block)');
          // eslint-disable-next-line no-await-in-loop
          await sleep(backoff);
        }
      }
    }
    scanDebug(chain.id, 'scan GAVE UP after ' + maxAttempts + ' attempts: ' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
  })().finally(() => {
    scanInFlight.delete(k); // release the per-chain mutex
  });

  scanInFlight.set(k, p);
  return p;
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
  const forceFullRescan = !!(params && params.forceFullRescan);
  scanDebug(0, 'balances() called wallet=' + String(walletId).slice(0, 14) + ' loadedNets=[' + state.networks.join(',') + ']' + (forceFullRescan ? ' forceFullRescan' : ''));

  // ChainType.EVM === 0; ids: Ethereum=1, Sepolia=11155111.
  const targets = [
    { net: 'mainnet', chainId: 1 },
    { net: 'sepolia', chainId: 11155111 },
  ];
  let scanning = false;
  const networks = {};
  for (const t of targets) {
    const chain = { type: shared.ChainType ? shared.ChainType.EVM : 0, id: t.chainId };
    // ONLY scan chains in cfg.scanChainIds (Sepolia). Scanning mainnet here is what
    // grabbed the global rescan lock and wedged Sepolia at 50% — so we skip it.
    if (!cfg.scanChainIds.has(t.chainId)) {
      scanDebug(t.chainId, 'scan SKIPPED (' + t.net + ') - not in scanChainIds; avoids global rescan-lock wedge');
    } else if (state.networks.indexOf(t.net) === -1) {
      scanDebug(t.chainId, 'scan SKIPPED (' + t.net + ') — provider not loaded');
    } else {
      // Kick the SERIALIZED background scan (incremental by default, mutex per
      // chain+wallet). A duplicate balances() call no-ops onto the in-flight
      // promise — it never starts a second rescan, so the "Full rescan already
      // in progress" collision (vc23) can't happen. We don't await it here: the
      // balanceUpdate callback fills the cache + the panel shows scan lifecycle,
      // so we still return promptly with whatever's cached.
      runSerializedScan(sdk, chain, walletId, { forceFullRescan }).catch((e) =>
        scanDebug(t.chainId, 'serialized scan rejected (' + t.net + '): ' + (e && e.message ? e.message : String(e))),
      );
      scanning = true;
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
