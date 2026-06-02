/* EAS build hook: install the embedded Node host's deps so they are present for
 * nodejs-mobile-react-native's gradle bundling + per-ABI native rebuild.
 *
 * WHY: nodejs-mobile-react-native's android/build.gradle COPIES
 * nodejs-assets/nodejs-project (incl. its node_modules) into the APK and rebuilds
 * the native .node addons per ABI — but it does NOT run `npm install` itself; it
 * expects node_modules to already exist. We don't commit node_modules (908 pkgs +
 * a 157MB prover binary), so we install them here, after EAS's main JS install,
 * via `eas-build-post-install` (apps/app/package.json). The RAILGUN engine deps
 * are real Node deps — they never enter the Metro graph (nodejs-assets is in
 * metro.config.js blockList), so installing them here is safe for the bundle.
 *
 * Locally this is a no-op for the Metro bundler; it only matters in EAS / a
 * native prebuild. Idempotent: skips if node_modules already looks populated. */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projDir = path.resolve(__dirname, '..', 'nodejs-assets', 'nodejs-project');
const appDir = path.resolve(__dirname, '..');
const marker = path.join(projDir, 'node_modules', '@railgun-community', 'wallet', 'package.json');

/* nodejs-mobile-react-native's gradle per-ABI rebuild (BuildNpmModules<abi>)
 * runs `npm rebuild` on the copied nodejs-project; its scripts/patch-package.js
 * rewrites each native module's `install` script to call the ABSOLUTE path
 *   $PROJECT_DIR/../node_modules/.bin/node-gyp-build-mobile
 * where $PROJECT_DIR == apps/app/android, i.e. it expects the binary at
 *   apps/app/node_modules/.bin/node-gyp-build-mobile
 * node-gyp-build-mobile is a (transitive) dep of nodejs-mobile-react-native.
 * Under bun's workspace install it lands in node_modules/.bun/... and is NOT
 * symlinked into apps/app/node_modules/.bin, so the rebuild dies with
 *   sh: node-gyp-build-mobile: not found  (exit 127).
 * Recreate the bins here so gradle's hard-coded path resolves. Idempotent. */
function linkNodeGypBuildMobileBin() {
  let pkgJson;
  try {
    pkgJson = require.resolve('node-gyp-build-mobile/package.json', {
      paths: [require.resolve('nodejs-mobile-react-native/package.json', { paths: [appDir] })],
    });
  } catch (err) {
    process.stderr.write(
      '[install-nodejs-project] could not resolve node-gyp-build-mobile: ' +
        (err && err.message) + '\n',
    );
    return;
  }
  const pkgDir = path.dirname(pkgJson);
  const bins = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).bin || {};
  const binDir = path.join(appDir, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  for (const [name, rel] of Object.entries(bins)) {
    const target = path.resolve(pkgDir, rel);
    const linkPath = path.join(binDir, name);
    try {
      if (fs.existsSync(linkPath) || fs.lstatSync(linkPath)) fs.rmSync(linkPath, { force: true });
    } catch {}
    try {
      fs.symlinkSync(path.relative(binDir, target), linkPath);
    } catch {
      // fall back to a copy if symlinks are unavailable
      fs.copyFileSync(target, linkPath);
    }
    try { fs.chmodSync(target, 0o755); } catch {}
    process.stdout.write('[install-nodejs-project] linked .bin/' + name + '\n');
  }
}

function main() {
  if (!fs.existsSync(path.join(projDir, 'package.json'))) {
    process.stdout.write('[install-nodejs-project] no nodejs-project — skipping\n');
    return;
  }
  if (fs.existsSync(marker)) {
    process.stdout.write('[install-nodejs-project] deps already installed — skipping install\n');
  } else {
    process.stdout.write('[install-nodejs-project] installing embedded Node host deps…\n');
    execSync('npm install --no-audit --no-fund --loglevel=error', {
      cwd: projDir,
      stdio: 'inherit',
    });
  }
  // Always (re)create the bin gradle's per-ABI rebuild hard-codes.
  linkNodeGypBuildMobileBin();
  process.stdout.write('[install-nodejs-project] done\n');
}

main();
