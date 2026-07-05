/* Patch @railgun-community/engine V2 RailgunSmartWallet historical scan so the
 * eth_getLogs requests are TOPIC-FILTERED to only the Railgun event types the
 * scan actually consumes, instead of the SDK's unfiltered `queryFilter('*')`.
 *
 * WHY: engine/dist/contracts/railgun-smart-wallet/V2/railgun-smart-wallet.js
 * does:
 *     this.contract.queryFilter('*', startBlock, endBlock)
 * which issues an eth_getLogs with NO `topics` filter — the node returns EVERY
 * log the RailgunSmartWallet proxy ever emitted in that range, including admin/
 * governance noise (OwnershipTransferred, FeeChange, TreasuryChange,
 * AddToBlocklist/RemoveFromBlocklist, Initialized, VerifyingKeySet). The engine
 * then throws ~6 of 14 event types away client-side via filterEventsByTopic().
 * On Sepolia (slow, rate-limited public/dRPC endpoints) the larger response
 * bodies + extra decode are a real cost and contribute to the 5s getLogs
 * timeout ("Scan query error at block N. Retrying 29 times.").
 *
 * FIX: replace `'*'` with a single OR-of-topics filter `{ topics: [[...]] }`
 * covering exactly the 8 consumed event types (current V2 + legacy V1), so the
 * RPC returns ONLY relevant logs. Address scoping is unchanged (queryFilter is
 * already bound to the contract address). Behaviour is identical because the
 * engine only ever keeps these topics anyway; we just move the filter from the
 * client to the server. The legacy pre-Mar-2023 Shield topic is included too.
 *
 * Idempotent + non-fatal: re-running is a no-op; a missing/changed file exits 0
 * with a warning so lint-only checkouts and future SDK bumps don't break the
 * install. */
'use strict';

const fs = require('fs');
const path = require('path');

const target = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@railgun-community',
  'engine',
  'dist',
  'contracts',
  'railgun-smart-wallet',
  'V2',
  'railgun-smart-wallet.js',
);

// The verbatim unfiltered call we are replacing.
const NEEDLE =
  "this.contract.queryFilter('*', startBlock, endBlock), EVENTS_SCAN_TIMEOUT, SCAN_TIMEOUT_ERROR_MESSAGE);";

// Topic0 hashes for the event types the V2 scan actually consumes.
//   Current (post-V2):   Shield, Transact, Unshield, Nullified
//   Legacy (pre-V2/V1):  GeneratedCommitmentBatch, CommitmentBatch, Nullifiers
//   Legacy Shield (pre-Mar-2023) — different topic from current Shield.
// Derived from ABIRailgunSmartWallet + ABIRailgunSmartWallet_Legacy_PreMar23;
// kept as a literal so the patch has no runtime ABI dependency. Verified against
// the installed ABI at patch-authoring time (see report).
const RAILGUN_SCAN_TOPICS = [
  '0x3a5b9dc26075a3801a6ddccf95fec485bb7500a91b44cec1add984c21ee6db3b', // Shield (Mar23)
  '0x56a618cda1e34057b7f849a5792f6c8587a2dbe11c83d0254e72cb3daffda7d1', // Transact
  '0xd93cf895c7d5b2cd7dc7a098b678b3089f37d91f48d9b83a0800a91cbdf05284', // Unshield
  '0x781745c57906dc2f175fec80a9c691744c91c48a34a83672c41c2604774eb11f', // Nullified
  '0xf75eaa09da191ca634619d229eaa2a62f3f30b79ef6e9a0a2cb33ae1dc07d71c', // GeneratedCommitmentBatch (legacy)
  '0xc82d23263b236b692a8094d858e0831328f26cd9bcd5127d91c9299036cb9de9', // CommitmentBatch (legacy)
  '0x78b6af109cf8ed292e957cdc2975e50bfd37995f5c38d35dc10e2ed0007cbd09', // Nullifiers (legacy)
  '0xc3821e11e71307afd1d94a490660178ff37aefdd3c0514e5dd08937bd7024f34', // Shield (legacy pre-Mar-2023)
];

// The replacement passes an ethers v6 topic-OR filter. queryFilter accepts an
// ARRAY of topic positions; an array element that is itself an array is an
// OR-set at that position. So `[[h0, h1, ...]]` matches any log whose topic0 is
// one of the Railgun event hashes — i.e. `topics: [[...]]` server-side. ethers'
// getSubInfo normalizes the hashes and the result rows still decode via the
// contract interface exactly as before. (A plain {address,topics} object is NOT
// accepted by queryFilter — it must be the array form.)
const REPLACEMENT =
  'this.contract.queryFilter([' +
  JSON.stringify(RAILGUN_SCAN_TOPICS) +
  '], startBlock, endBlock), EVENTS_SCAN_TIMEOUT, SCAN_TIMEOUT_ERROR_MESSAGE);';

function run() {
  if (!fs.existsSync(target)) {
    process.stderr.write(
      '[patch-getlogs-topics] engine V2 contract not found — skipping ' +
        '(engine not installed in this checkout)\n',
    );
    return;
  }
  const src = fs.readFileSync(target, 'utf8');
  if (src.includes(RAILGUN_SCAN_TOPICS[0])) {
    process.stdout.write('[patch-getlogs-topics] already patched — skipping\n');
    return;
  }
  if (!src.includes(NEEDLE)) {
    process.stderr.write(
      '[patch-getlogs-topics] expected queryFilter(\'*\') call not found — ' +
        'skipping (engine version changed; re-verify the scan filter manually)\n',
    );
    return;
  }
  fs.writeFileSync(target, src.replace(NEEDLE, REPLACEMENT), 'utf8');
  process.stdout.write(
    '[patch-getlogs-topics] topic-filtered V2 historical getLogs scan\n',
  );
}

try {
  run();
} catch (err) {
  process.stderr.write('[patch-getlogs-topics] ' + (err && err.message) + '\n');
}
