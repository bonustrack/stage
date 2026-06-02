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

/* Make node_modules safe for nodejs-mobile's asset bundling.
 *
 * ROOT CAUSE of the "Node assets copy failed" launch crash:
 * nodejs-mobile-react-native's gradle does two passes over nodejs-project:
 *   1. GenerateNodeProjectAssetsLists builds `file.list` with a Gradle
 *      fileTree(...).visit, excluding only `**​/.*` (dotfiles) and `**​/*~`.
 *   2. aapt merges nodejs-project/** into the APK assets, but aapt's DEFAULT
 *      ignoreAssetsPattern drops `<dir>_*` (any `_`-prefixed entry — dirs AND
 *      files, e.g. lodash internals like `_baseClone.js`) and `.*` (dotfiles).
 * Gradle LISTS the `_`-prefixed entries in `file.list`, but the DEFAULT aapt
 * pattern NEVER packages them → at launch RNNodeJsMobileModule reads `file.list`,
 * calls AssetManager.open() on a path that isn't a real asset →
 * FileNotFoundException → RuntimeException("Node assets copy failed").
 *
 * THE REAL FIX lives in withNodejsMobile.js: it OVERRIDES aapt's
 * ignoreAssetsPattern to `.*:*~` so aapt now packages `_`-prefixed dirs AND files
 * (we MUST keep them — lodash et al. require() `_*.js` at runtime; deleting them
 * would break the engine). With that override, packaged == file.list.
 *
 * This prune therefore only has to keep file.list and the packaged set in lockstep
 * by removing what NEITHER should contain:
 *   - symlinks: AssetManager can't open them and aapt won't package them, yet a
 *     symlink-to-file can still be visited/listed by Gradle's fileTree → mismatch.
 *   - dot-prefixed entries (`.*`): Gradle excludes these from file.list AND aapt
 *     ignores them; removing them on disk keeps the tree clean and is harmless.
 * We do NOT touch `_`-prefixed dirs or files anymore — aapt now packages them and
 * the runtime needs the files. Idempotent. */
function pruneForAssetBundling() {
  const nm = path.join(projDir, 'node_modules');
  if (!fs.existsSync(nm)) return;
  let removed = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      // Symlinks: AssetManager can't open them; aapt won't package them either.
      if (ent.isSymbolicLink()) {
        try { fs.rmSync(full, { force: true }); removed++; } catch {}
        continue;
      }
      // Dotfiles/-dirs (`.*`): excluded from Gradle's file.list AND ignored by
      // aapt. Remove on disk so the tree matches both sets. Do NOT special-case
      // `_`-prefixed entries: the aapt override now packages them and the runtime
      // require()s the `_*.js` files (e.g. lodash internals).
      if (ent.name.startsWith('.')) {
        try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch {}
        continue;
      }
      if (ent.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(nm);
  process.stdout.write(
    '[install-nodejs-project] pruned ' + removed +
      ' asset-unsafe entries (symlinks / dotfiles) from node_modules\n',
  );
  const left = countSymlinks(nm);
  process.stdout.write(
    '[install-nodejs-project] symlinks remaining under node_modules: ' + left + '\n',
  );
}

function countSymlinks(dir) {
  let n = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) n++;
    else if (ent.isDirectory()) n += countSymlinks(full);
  }
  return n;
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
  // Strip everything nodejs-mobile's asset bundling can't faithfully package
  // (the cause of the "Node assets copy failed" launch crash). Always run — it
  // is idempotent and cheap, and must happen BEFORE gradle's
  // GenerateNodeProjectAssetsLists / aapt merge (both run in the later gradle
  // phase; this eas-build-post-install hook runs first).
  pruneForAssetBundling();
  // Always (re)create the bin gradle's per-ABI rebuild hard-codes. (.bin lives
  // under a dot dir excluded from the asset list, so this is safe post-prune.)
  linkNodeGypBuildMobileBin();
  process.stdout.write('[install-nodejs-project] done\n');
}

main();
