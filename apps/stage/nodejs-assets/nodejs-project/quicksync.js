/* Raw-HTTP RAILGUN quick-sync - root-cause fix for "Failed to quick sync" +
 * "Failed to sync Railgun transactions V2" inside nodejs-mobile.
 *
 *  PROBLEM (see issue #261):
 *  startRailgunEngine() HARDCODES the wallet SDK's graphql-mesh-based quick-sync
 *  (quickSyncEventsGraph + quickSyncRailgunTransactionsV2). That stack pulls the
 *  full @graphql-mesh/runtime + @whatwg-node/fetch machinery, which is the most
 *  fragile part of the engine inside nodejs-mobile (Node 18 without full ICU,
 *  partial undici/TLS). When it throws, the engine logs "Failed to quick sync" /
 *  "Failed to sync Railgun transactions V2" and falls back to an on-chain
 *  eth_getLogs slow scan in 200-block chunks. Covering the RAILGUN Sepolia
 *  deployment (~5.94M) to chain tip (~11M) = ~25,000 sequential getLogs calls on
 *  public RPCs, which rate-limits / stalls and effectively never completes - so
 *  the UTXO merkletree never gets the wallet's commitments and every balance
 *  bucket reads 0. (The squid subgraph itself is healthy; only the on-device
 *  graphql-mesh TRANSPORT fails.)
 *
 *  FIX:
 *  Replace ONLY the transport. We reuse the wallet SDK's OWN GraphQL Documents
 *  and OWN result formatters (so the merkletree-fed event shapes are byte-for-
 *  byte identical to the supported path) and swap graphql-mesh for a plain Node
 *  `https` POST to the squid endpoint. We then patch the live engine instance's
 *  `quickSyncEvents` + `quickSyncRailgunTransactionsV2` via getEngine().
 *
 *  This file is plain Node CommonJS, bundled into the nodejs-mobile native asset
 *  -> it requires a NEW APK to take effect (it never enters the Metro JS graph).
 */
'use strict';

const https = require('https');
const path = require('path');
const { URL } = require('url');

/** The wallet package.json "exports" field BLOCKS deep subpath specifiers like
 *  require('@railgun-community/wallet/dist/services/...'). Resolve the package
 *  ROOT once and require the internal CJS modules by ABSOLUTE file path, which
 *  is not subject to the exports gate. */
function walletRoot() {
  // require.resolve('@railgun-community/wallet') -> .../dist/index.js
  const main = require.resolve('@railgun-community/wallet');
  const marker = path.sep + 'dist' + path.sep;
  const idx = main.indexOf(marker);
  return idx >= 0 ? main.slice(0, idx) : path.dirname(main);
}
function walletRequire(rel) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(path.join(walletRoot(), 'dist', rel));
}

/* Squid GraphQL endpoint base (UTXO + txid share the same squid host). Mirror
 * the SDK's baked-in endpoints (quick-sync/V2/graphql + railgun-txids/graphql
 * index.js). Keyed by the NetworkName ENUM KEY (Ethereum / EthereumSepolia /
 * ...) and resolved against the enum's VALUE at runtime (the value string is
 * "Ethereum_Sepolia", not "EthereumSepolia"), so we never hardcode the value. */
const SQUID_ENDPOINT_BY_KEY = {
  Ethereum: 'https://rail-squid.squids.live/squid-railgun-ethereum-v2/graphql',
  EthereumSepolia: 'https://rail-squid.squids.live/squid-railgun-eth-sepolia-v2/graphql',
  BNBChain: 'https://rail-squid.squids.live/squid-railgun-bsc-v2/graphql',
  Polygon: 'https://rail-squid.squids.live/squid-railgun-polygon-v2/graphql',
  Arbitrum: 'https://rail-squid.squids.live/squid-railgun-arbitrum-v2/graphql',
};

/** Serialize a SDK GraphQL Document AST to a query string. The codegen-built
 *  Documents (quick-sync/V2) have no .loc, so we need graphql.print; the
 *  gql-tagged txid Documents carry .loc.source.body. Try both. `graphql` is
 *  bundled into the APK (graphql-mesh depends on it) so require() resolves
 *  on-device even though it isn't a top-level dep in the repo worktree. */
let _print = null;
function printDocument(document) {
  if (typeof document === 'string') return document;
  if (document && document.loc && document.loc.source && document.loc.source.body) {
    return document.loc.source.body;
  }
  if (!_print) {
    // eslint-disable-next-line global-require
    _print = require('graphql').print;
  }
  return _print(document);
}

/** One raw GraphQL POST over Node https. Resolves data, throws on HTTP / GraphQL
 *  error so the caller's try/catch (and our diagnostics) see a real failure. */
function gqlPost(endpoint, query, variables) {
  return new Promise((resolve, reject) => {
    let body;
    try {
      body = JSON.stringify({ query, variables: variables || {} });
    } catch (e) {
      reject(e);
      return;
    }
    let u;
    try {
      u = new URL(endpoint);
    } catch (e) {
      reject(e);
      return;
    }
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 25000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error('quicksync HTTP ' + res.statusCode + ': ' + text.slice(0, 200)));
            return;
          }
          let json;
          try {
            json = JSON.parse(text);
          } catch (e) {
            reject(new Error('quicksync bad JSON: ' + text.slice(0, 200)));
            return;
          }
          if (json.errors && json.errors.length) {
            reject(new Error('quicksync GraphQL error: ' + JSON.stringify(json.errors).slice(0, 300)));
            return;
          }
          resolve(json.data || {});
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('quicksync request timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Build a SDK-shaped `sdk` object (Nullifiers/Unshields/Commitments/...) whose
 *  requester is our raw https POST instead of graphql-mesh. Reuses the SDK's own
 *  getSdk + Documents so query fields stay correct. */
function buildRawSdk(getSdk, endpoint) {
  return getSdk((document, variables) => {
    const query = printDocument(document);
    return gqlPost(endpoint, query, variables);
  });
}

/** Install raw-http quick-sync onto the live engine. Call AFTER
 *  startRailgunEngine (engine instance exists) and BEFORE any scan. Idempotent.
 *  `log` is an optional (chainId, msg) diagnostics sink. Returns true on patch. */
function installRawHttpQuickSync(sdk, log) {
  const note = typeof log === 'function' ? log : function () {};
  // eslint-disable-next-line global-require
  const shared = require('@railgun-community/shared-models');
  const { NetworkName, networkForChain, isDefined } = shared;

  // SDK internals (plain CJS in dist) - reuse documents + formatters so the
  // event shapes fed into the merkletree are identical to the supported path.
  // Required by ABSOLUTE path (see walletRequire) to bypass the exports gate.
  const utxoGraphql = walletRequire('services/railgun/quick-sync/V2/graphql');
  const fmt = walletRequire('services/railgun/quick-sync/V2/graph-type-formatters-v2');
  const graphUtil = walletRequire('services/railgun/util/graph-util');
  const txidGraphql = walletRequire('services/railgun/railgun-txids/graphql');
  const txidFmt = walletRequire('services/railgun/railgun-txids/railgun-txid-graph-type-formatters');

  const removeDuplicatesByID = graphUtil.removeDuplicatesByID;
  const MAX_QUERY_RESULTS = 100000;

  // Map each supported NetworkName VALUE (e.g. "Ethereum_Sepolia") to its squid
  // endpoint, derived from the enum keys so we never depend on the raw value.
  const ENDPOINT_BY_VALUE = {};
  for (const key of Object.keys(SQUID_ENDPOINT_BY_KEY)) {
    const value = NetworkName[key];
    if (value) ENDPOINT_BY_VALUE[value] = SQUID_ENDPOINT_BY_KEY[key];
  }
  function endpointForNetwork(networkName) {
    return ENDPOINT_BY_VALUE[networkName];
  }

  // Mirror quick-sync/graph-query.autoPaginatingQuery (by-blockNumber cursor).
  async function autoPaginateByBlock(queryFn, startBlock, prev) {
    const results = prev || [];
    const newResults = await queryFn(startBlock);
    if (!newResults || newResults.length === 0) return results;
    const total = results.concat(newResults);
    const last = total[total.length - 1];
    const shouldMore = newResults.length === 10000 && total.length < MAX_QUERY_RESULTS;
    if (!shouldMore) return total;
    await shared.delay(250);
    return autoPaginateByBlock(queryFn, last.blockNumber, total);
  }

  // Mirror quick-sync-events-graph-v2.createGraphCommitmentBatches.
  function createGraphCommitmentBatches(flattened) {
    const map = {};
    for (const c of flattened) {
      const sp = c.batchStartTreePosition;
      if (map[sp]) {
        map[sp].commitments.push(c);
      } else {
        map[sp] = {
          commitments: [c],
          transactionHash: c.transactionHash,
          treeNumber: c.treeNumber,
          startPosition: c.batchStartTreePosition,
          blockNumber: Number(c.blockNumber),
        };
      }
    }
    return Object.values(map);
  }
  function sortBatches(a, b) {
    if (a.treeNumber !== b.treeNumber) return a.treeNumber < b.treeNumber ? -1 : 1;
    if (a.startPosition !== b.startPosition) return a.startPosition < b.startPosition ? -1 : 1;
    return 0;
  }

  const SUPPORTED = {
    [NetworkName.Ethereum]: true,
    [NetworkName.EthereumSepolia]: true,
    [NetworkName.BNBChain]: true,
    [NetworkName.Polygon]: true,
    [NetworkName.Arbitrum]: true,
  };

  // ── Replacement quickSyncEvents (UTXO commitments/nullifiers/unshields) ──
  async function rawQuickSyncEvents(txidVersion, chain, startingBlock) {
    const network = networkForChain(chain);
    const EMPTY = { commitmentEvents: [], unshieldEvents: [], nullifierEvents: [] };
    if (!network || !SUPPORTED[network.name]) return EMPTY;
    const endpoint = endpointForNetwork(network.name);
    if (!endpoint) return EMPTY;
    const rawSdk = buildRawSdk(utxoGraphql.getSdk, endpoint);
    const startStr = startingBlock != null ? startingBlock.toString() : '0';

    const nullifiers = await autoPaginateByBlock(
      async (b) => (await rawSdk.Nullifiers({ blockNumber: b })).nullifiers,
      startStr,
    );
    await shared.delay(100);
    const unshields = await autoPaginateByBlock(
      async (b) => (await rawSdk.Unshields({ blockNumber: b })).unshields,
      startStr,
    );
    await shared.delay(100);
    const commitments = await autoPaginateByBlock(
      async (b) => (await rawSdk.Commitments({ blockNumber: b })).commitments,
      startStr,
    );

    const fNull = removeDuplicatesByID(nullifiers);
    const fUns = removeDuplicatesByID(unshields);
    const fComm = removeDuplicatesByID(commitments);
    const batches = createGraphCommitmentBatches(fComm).sort(sortBatches);

    note(chain && chain.id, 'rawQuickSync events: commitments=' + fComm.length + ' nullifiers=' + fNull.length + ' unshields=' + fUns.length);

    return {
      nullifierEvents: fmt.formatGraphNullifierEventsV2(fNull),
      unshieldEvents: fmt.formatGraphUnshieldEventsV2(fUns),
      commitmentEvents: fmt.formatGraphCommitmentEventsV2(batches),
    };
  }

  // ── Replacement quickSyncRailgunTransactionsV2 (txid merkletree) ──
  const TXID_MAX = 5000;
  async function autoPaginateById(queryFn, idLow, prev) {
    const results = prev || [];
    const newResults = await queryFn(idLow);
    if (!newResults || newResults.length === 0) return results;
    const total = results.concat(newResults);
    const last = total[total.length - 1];
    const shouldMore = newResults.length === 5000 && total.length < TXID_MAX;
    if (!shouldMore) return total;
    await shared.delay(250);
    // Cursor field is `id` with where:{id_gt:$idLow} (see SDK
    // GetRailgunTransactionsAfterGraphID query + its autoPaginatingQuery).
    return autoPaginateById(queryFn, last.id, total);
  }
  async function rawQuickSyncTxidsV2(chain, latestGraphID) {
    const network = networkForChain(chain);
    if (!network || !isDefined(network.poi)) return [];
    const endpoint = endpointForNetwork(network.name);
    if (!endpoint) return [];
    const rawSdk = buildRawSdk(txidGraphql.getSdk, endpoint);
    const transactions = await autoPaginateById(
      async (id) => (await rawSdk.GetRailgunTransactionsAfterGraphID({ idLow: id })).transactions,
      latestGraphID != null ? latestGraphID : '0x00',
    );
    const filtered = removeDuplicatesByID(transactions);
    note(chain && chain.id, 'rawQuickSync txids: ' + filtered.length);
    return txidFmt.formatRailgunTransactions(filtered);
  }

  // Patch the live engine instance.
  if (!sdk.hasEngine || !sdk.hasEngine()) {
    note(0, 'rawQuickSync: no engine to patch (skipped)');
    return false;
  }
  const engine = sdk.getEngine();
  if (!engine) {
    note(0, 'rawQuickSync: getEngine() empty (skipped)');
    return false;
  }
  engine.quickSyncEvents = rawQuickSyncEvents;
  engine.quickSyncRailgunTransactionsV2 = rawQuickSyncTxidsV2;
  note(0, 'rawQuickSync installed (graphql-mesh transport bypassed)');
  return true;
}

module.exports = { installRawHttpQuickSync };
