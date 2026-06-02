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
 *      ignoreAssetsPattern drops `<dir>_*` (any `_`-prefixed DIRECTORY, e.g.
 *      __tests__/__fixtures__) and `.*` (dotfiles). (aapt's `<dir>_*` token
 *      matches DIRECTORY names, not arbitrary files — `_version.js` etc. ARE
 *      packaged; only `_`-prefixed dirs are dropped.)
 * Gradle LISTS the files under `_`-prefixed dirs in `file.list`, but the DEFAULT
 * aapt pattern NEVER packages them → at launch RNNodeJsMobileModule reads
 * `file.list`, calls AssetManager.open() on a path that isn't a real asset →
 * FileNotFoundException → RuntimeException("Node assets copy failed").
 *
 * THE FIX (deterministic-by-construction): DELETE every `_`-prefixed DIRECTORY
 * from node_modules on disk BEFORE gradle runs. Then neither file.list nor the
 * packaged set contains them → they stay in lockstep regardless of whether the
 * aapt ignoreAssetsPattern override in withNodejsMobile.js actually takes effect.
 * These dirs are ALL test/fixture trees (__tests__, __fixtures__, __flowtests__
 * under @railgun-community/wallet, metro, metro-config, metro-file-map, ob1,
 * flow-enums-runtime) — never required at runtime, safe to delete.
 *
 * WHY THIS RATHER THAN RELYING ON THE aapt OVERRIDE (regression history):
 *   - ded2a8f shipped this exact `_`-DIR prune and its APK (build 34f5f215) had
 *     ZERO files listed-but-missing — the prune WORKED.
 *   - 5c783c4 then DELETED the `_`-dir prune and bet solely on the aapt
 *     `ignoreAssetsPattern '.*:*~'` override in withNodejsMobile.js. That override
 *     did NOT take effect, so its APK (build 51ec2304) had 120 files listed in
 *     file.list but absent from the packaged assets — ALL under `__`-prefixed test
 *     dirs — and crashed at launch. We restore the prune as the PRIMARY fix and
 *     keep the aapt override only as harmless defense-in-depth.
 *
 * CRITICAL: only `_`-prefixed DIRECTORIES are deleted. `_`-prefixed FILES
 * (e.g. @ethersproject `_version.js`, lodash `_baseClone.js`) are KEPT — aapt
 * packages them and the runtime require()s them; deleting them would break the
 * engine. We also remove what NEITHER set should contain:
 *   - symlinks: AssetManager can't open them and aapt won't package them, yet a
 *     symlink-to-file can still be visited/listed by Gradle's fileTree → mismatch.
 *   - dot-prefixed entries (`.*`): Gradle excludes these from file.list AND aapt
 *     ignores them; removing them on disk keeps the tree clean and is harmless.
 * Recurses into nested node_modules at every depth. Idempotent. */
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
      // aapt. Remove on disk so the tree matches both sets.
      if (ent.name.startsWith('.')) {
        try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch {}
        continue;
      }
      if (ent.isDirectory()) {
        // `_`-prefixed DIRECTORY: aapt's default ignoreAssetsPattern drops the
        // whole dir, but Gradle's file.list lists its files → FileNotFoundException
        // at launch. Delete it so neither set contains it. These are ALL test/
        // fixture trees (__tests__, __fixtures__, __flowtests__) — never needed at
        // runtime. (Matches the basename, so it catches them at EVERY depth,
        // including nested node_modules.) `_`-prefixed FILES are NOT matched here
        // — they fall through to walk()-free retention and stay packaged.
        if (ent.name.startsWith('_')) {
          try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch {}
          continue;
        }
        walk(full);
      }
    }
  };
  walk(nm);
  process.stdout.write(
    '[install-nodejs-project] pruned ' + removed +
      ' asset-unsafe entries (symlinks / dot- / _-dirs) from node_modules\n',
  );
  const left = countSymlinks(nm);
  process.stdout.write(
    '[install-nodejs-project] symlinks remaining under node_modules: ' + left + '\n',
  );
}

/* nodejs-mobile's bundled Node v18 is built `--with-intl=none` (no ICU). RegExp
 * Unicode property escapes (`\p{...}`) require ICU and throw at PARSE time:
 *   SyntaxError: Invalid property name in character class
 * In the entire engine runtime closure exactly ONE dep trips it:
 *   urlpattern-polyfill (pulled in eagerly by @whatwg-node/fetch →
 *   @graphql-mesh → @railgun-community/wallet). Its dist/urlpattern.{cjs,js}
 *   have TOP-LEVEL (eager, throw-on-require) regexes using \p{ID_Start} /
 *   \p{ID_Continue}, plus inline occurrences. A none-ICU binary can't be fixed
 *   with runtime ICU data — so we rewrite the regexes to ASCII fallbacks.
 *
 * These URLPattern grammar identifiers are always ASCII in this context, so the
 * ASCII classes are behavior-preserving here:
 *   \p{ID_Start}    → A-Za-z      (identifier start: letters, plus the literal
 *                                  `$ _` already present in the source class)
 *   \p{ID_Continue} → 0-9A-Za-z   (identifier continue: + digits)
 * We do a global string replace keyed on the exact `\p{ID_Start}` /
 * `\p{ID_Continue}` substrings so every occurrence (top-level + inline ~1121)
 * is caught. Idempotent: once rewritten there are no `\p{...}` left to match.
 * Deps install FRESH at EAS time (above), so this MUST run here, not via a
 * committed patch. */
function patchUrlPatternForNoICU() {
  const nm = path.join(projDir, 'node_modules');
  if (!fs.existsSync(nm)) return;
  // Exact substrings to rewrite. \p{ID_Start} sits in a class `[$_\p{ID_Start}]`
  // and \p{ID_Continue} in `[$_<zwnj><zwj>\p{ID_Continue}]`; we only touch the
  // \p{...} token itself so the surrounding class (incl. $ _ and the ZWNJ/ZWJ)
  // is preserved verbatim.
  const subs = [
    ['\\p{ID_Start}', 'A-Za-z'],
    ['\\p{ID_Continue}', '0-9A-Za-z'],
  ];
  const targets = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        walk(full);
      } else if (
        ent.name === 'urlpattern.cjs' ||
        ent.name === 'urlpattern.js'
      ) {
        // only the urlpattern-polyfill dist copies
        if (full.includes(path.join('urlpattern-polyfill', 'dist'))) {
          targets.push(full);
        }
      }
    }
  };
  walk(nm);
  let filesPatched = 0;
  let totalOccurrences = 0;
  for (const file of targets) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    let occ = 0;
    let out = src;
    for (const [needle, repl] of subs) {
      let idx = 0;
      while ((idx = out.indexOf(needle, idx)) !== -1) {
        occ++;
        idx += needle.length;
      }
      out = out.split(needle).join(repl);
    }
    if (occ > 0) {
      fs.writeFileSync(file, out);
      filesPatched++;
      totalOccurrences += occ;
      process.stdout.write(
        '[install-nodejs-project] patched ' + occ +
          ' \\p{} regex(es) in ' + path.relative(nm, file) + '\n',
      );
    }
  }
  process.stdout.write(
    '[install-nodejs-project] urlpattern no-ICU patch: ' + filesPatched +
      ' file(s), ' + totalOccurrences + ' occurrence(s) rewritten' +
      (targets.length === 0 ? ' (no urlpattern-polyfill found)' : '') + '\n',
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
  // Rewrite urlpattern-polyfill's \p{} regexes to ASCII so the engine's eager
  // require() of @whatwg-node/fetch doesn't SyntaxError on the no-ICU
  // nodejs-mobile Node v18. Idempotent; must run after install, before gradle.
  patchUrlPatternForNoICU();
  // Always (re)create the bin gradle's per-ABI rebuild hard-codes. (.bin lives
  // under a dot dir excluded from the asset list, so this is safe post-prune.)
  linkNodeGypBuildMobileBin();
  process.stdout.write('[install-nodejs-project] done\n');
}

main();
