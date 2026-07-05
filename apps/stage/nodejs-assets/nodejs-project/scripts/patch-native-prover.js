/* Patch @railgun-privacy/native-prover so node-gyp-build finds the prebuilt
 * .node addon when this Node host runs inside nodejs-mobile.
 *
 * WHY: the published tarball's dist/ts/index.js resolves the binding with
 *   require('node-gyp-build')(__dirname + '../../../')
 * which is a BROKEN path (string-concat, not path.resolve) — it points outside
 * the package, so node-gyp-build can't locate prebuilds/<platform>-<arch>/ and
 * tries (and fails) to compile from source. RAILGUN's own Railway-Wallet fixes
 * this with a patch-package patch; we replicate it here as an idempotent
 * postinstall so a fresh `npm install` in this folder yields a loadable prover.
 *
 * Idempotent + non-fatal: if the file is already patched or absent (e.g. the
 * dep wasn't installed in a lint-only checkout) it exits 0 quietly. */
'use strict';

const fs = require('fs');
const path = require('path');

const target = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@railgun-privacy',
  'native-prover',
  'dist',
  'ts',
  'index.js',
);

const BROKEN = "require('node-gyp-build')(__dirname + '../../../')";
const FIXED =
  "require('node-gyp-build')(require('path').resolve(__dirname, '../../'))";

function run() {
  if (!fs.existsSync(target)) return;
  const src = fs.readFileSync(target, 'utf8');
  if (src.includes(FIXED)) return;
  if (!src.includes(BROKEN)) {
    process.stderr.write(
      '[patch-native-prover] expected require pattern not found — skipping ' +
        '(prover may have changed; verify binding resolution manually)\n',
    );
    return;
  }
  fs.writeFileSync(target, src.replace(BROKEN, FIXED), 'utf8');
  process.stdout.write('[patch-native-prover] patched native-prover binding path\n');
}

try {
  run();
} catch (err) {
  process.stderr.write('[patch-native-prover] ' + (err && err.message) + '\n');
}
