/* Patch @railgun-community/engine so the historical-event scan succeeds
 * first-try on the public Sepolia RPC instead of timing out + burning ~28
 * retries per chunk (~1%/10min crawl observed on vc24).
 *
 * ROOT CAUSE (from on-device logs):
 *   `[Chain 0:11155111]: Scan query error at block N. Retrying 28 times.`
 *   + `Failed to scan V2 events` — the SAME block, counting down retries.
 * The engine's scanAllEvents() wraps `contract.queryFilter('*', start, end)`
 * in promiseTimeout(EVENTS_SCAN_TIMEOUT). The retry loop ONLY fires when the
 * caught error is the timeout (`cause.message === SCAN_TIMEOUT_ERROR_MESSAGE`).
 * So the chunk getLogs is genuinely TIMING OUT: SCAN_CHUNKS=499 blocks over a
 * busy range, fetched from a public dRPC over a mobile link, doesn't return
 * within the hard-coded 5s window → timeout → retry x28 → limp forward.
 *
 * FIX (three edits per scan file, V2 + V3):
 *   1. SCAN_CHUNKS 499 -> 200    (smaller block span => faster getLogs)
 *   2. EVENTS_SCAN_TIMEOUT 5000 -> 20000 (20s; a slow-but-VALID query now
 *      completes first try instead of being killed at 5s)
 *   3. Surface the REAL underlying RPC error in the retry log line (was
 *      swallowed) so the next on-device screenshot shows exactly what the RPC
 *      returns (429 rate-limit / -32005 range/result-too-large / etc.).
 *
 * Idempotent + non-fatal: re-running is a no-op; missing files (lint-only
 * checkout) exit 0 quietly. Runs as a postinstall so a fresh EAS `npm install`
 * in nodejs-project keeps the patch (mirrors patch-native-prover.js). */
'use strict';

const fs = require('fs');
const path = require('path');

const ENGINE_DIST = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@railgun-community',
  'engine',
  'dist',
  'contracts',
  'railgun-smart-wallet',
);

const TARGETS = [
  path.join(ENGINE_DIST, 'V2', 'railgun-smart-wallet.js'),
  path.join(ENGINE_DIST, 'V3', 'poseidon-merkle-accumulator.js'),
];

const EDITS = [
  // 1. wider block span per getLogs (fewer round-trips; topic-filtered so the
  //    response body stays small even over a 5000-block window)
  { from: 'const SCAN_CHUNKS = 499;', to: 'const SCAN_CHUNKS = 5000;' },
  // 2. longer per-query timeout (a slow-but-valid response now succeeds)
  { from: 'const EVENTS_SCAN_TIMEOUT = 5000;', to: 'const EVENTS_SCAN_TIMEOUT = 20000;' },
  {
    from: "const SCAN_TIMEOUT_ERROR_MESSAGE = 'getLogs request timed out after 5 seconds.';",
    to: "const SCAN_TIMEOUT_ERROR_MESSAGE = 'getLogs request timed out after 20 seconds.';",
  },
  // 3. log the REAL underlying RPC error (cause.message) — was swallowed. The
  //    template literal is identical in V2 + V3, so one edit covers both.
  {
    from:
      'debugger_1.default.log(`[Chain ${this.chain.type}:${this.chain.id}]: Scan query error at block ${startBlock}. Retrying ${MAX_SCAN_RETRIES - retry} times.`);',
    to:
      'debugger_1.default.log(`[Chain ${this.chain.type}:${this.chain.id}]: Scan query error at block ${startBlock}->${endBlock} (chunk=${endBlock - startBlock}): ${cause && cause.message ? cause.message : cause}. Retrying ${MAX_SCAN_RETRIES - retry} times.`);',
  },
];

function patchFile(target) {
  if (!fs.existsSync(target)) return false;
  let src = fs.readFileSync(target, 'utf8');
  let changed = false;
  for (const e of EDITS) {
    if (src.includes(e.to)) continue; // already patched (this edit)
    if (!src.includes(e.from)) continue; // pattern moved/renamed — skip safely
    src = src.split(e.from).join(e.to);
    changed = true;
  }
  if (changed) fs.writeFileSync(target, src, 'utf8');
  return changed;
}

function run() {
  let any = false;
  for (const t of TARGETS) {
    try {
      if (patchFile(t)) {
        any = true;
        process.stdout.write('[patch-scan-chunk] patched ' + path.relative(process.cwd(), t) + '\n');
      }
    } catch (err) {
      process.stderr.write('[patch-scan-chunk] ' + t + ': ' + (err && err.message) + '\n');
    }
  }
  if (!any) process.stdout.write('[patch-scan-chunk] nothing to patch (already patched or files absent)\n');
}

try {
  run();
} catch (err) {
  process.stderr.write('[patch-scan-chunk] ' + (err && err.message) + '\n');
}
