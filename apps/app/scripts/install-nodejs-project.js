/** @file EAS build hook installing the embedded Node host's deps for nodejs-mobile gradle bundling + per-ABI rebuild. */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projDir = path.resolve(__dirname, '..', 'nodejs-assets', 'nodejs-project');
const appDir = path.resolve(__dirname, '..');
const marker = path.join(projDir, 'node_modules', '@railgun-community', 'wallet', 'package.json');

/** Recreate node-gyp-build-mobile bins in app node_modules/.bin so gradle's hard-coded per-ABI rebuild path resolves. */
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
      /** Fall back to a copy if symlinks are unavailable. */
      fs.copyFileSync(target, linkPath);
    }
    try { fs.chmodSync(target, 0o755); } catch {}
    process.stdout.write('[install-nodejs-project] linked .bin/' + name + '\n');
  }
}

/** Delete asset-unsafe entries (underscore dirs, symlinks, dotfiles) so gradle's file.list and aapt stay in lockstep. */
function pruneForAssetBundling() {
  const nm = path.join(projDir, 'node_modules');
  if (!fs.existsSync(nm)) return;
  let removed = 0;
  /** Recurse a dir, removing symlinks, dotfiles, underscore dirs, and untokenizable AAB dir names. */
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      /** Symlinks: AssetManager can't open them; aapt won't package them either. */
      if (ent.isSymbolicLink()) {
        try { fs.rmSync(full, { force: true }); removed++; } catch {}
        continue;
      }
      /** Dotfiles/-dirs: excluded from Gradle's file.list AND ignored by aapt; remove so the tree matches both sets. */
      if (ent.name.startsWith('.')) {
        try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch {}
        continue;
      }
      if (ent.isDirectory()) {
        /** Underscore-prefixed DIR (test/fixture trees): aapt drops it but Gradle lists its files; delete at every depth. */
        if (ent.name.startsWith('_')) {
          try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch {}
          continue;
        }
        /** Drop bundletool-untokenizable dir names (es5-ext `#`/`@@iterator`); dead web3 subtree that blocks the AAB. */
        if (ent.name === '#' || ent.name.startsWith('@@') || ent.name === '@') {
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

/** Rewrite urlpattern-polyfill's Unicode property escapes to ASCII so the no-ICU nodejs-mobile Node v18 won't SyntaxError. */
function patchUrlPatternForNoICU() {
  const nm = path.join(projDir, 'node_modules');
  if (!fs.existsSync(nm)) return;
  /** Exact token substitutions; only the property-escape token is touched so the surrounding char class is preserved. */
  const subs = [
    ['\\p{ID_Start}', 'A-Za-z'],
    ['\\p{ID_Continue}', '0-9A-Za-z'],
  ];
  const targets = [];
  /** Recurse node_modules collecting urlpattern-polyfill dist files (urlpattern.cjs/.js) into targets. */
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
        /** Only the urlpattern-polyfill dist copies. */
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

/** Recursively count symlinks under a directory. */
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

/** Regenerate the bridge method manifest from the source-of-truth contract; non-fatal (CI parity test catches drift). */
function regenMethodManifest() {
  try {
    execSync('node ' + JSON.stringify(path.join(appDir, 'scripts', 'gen-railgun-methods.mjs')), {
      cwd: appDir,
      stdio: 'inherit',
    });
  } catch (err) {
    process.stderr.write(
      '[install-nodejs-project] gen-railgun-methods failed (non-fatal): ' +
        (err && err.message ? err.message : String(err)) + '\n',
    );
  }
}

/** Entry point: regen the manifest, install host deps if needed, then prune, patch, and link bins for gradle. */
function main() {
  if (!fs.existsSync(path.join(projDir, 'package.json'))) {
    process.stdout.write('[install-nodejs-project] no nodejs-project — skipping\n');
    return;
  }
  regenMethodManifest();
  if (fs.existsSync(marker)) {
    process.stdout.write('[install-nodejs-project] deps already installed — skipping install\n');
  } else {
    process.stdout.write('[install-nodejs-project] installing embedded Node host deps…\n');
    execSync('npm install --no-audit --no-fund --loglevel=error', {
      cwd: projDir,
      stdio: 'inherit',
    });
  }
  /** Strip asset-unsafe entries before gradle's asset list / aapt merge; idempotent and cheap. */
  pruneForAssetBundling();
  /** Rewrite urlpattern-polyfill regexes to ASCII so the no-ICU nodejs-mobile Node v18 won't SyntaxError. */
  patchUrlPatternForNoICU();
  /** (Re)create the bin gradle's per-ABI rebuild hard-codes; safe post-prune since .bin sits under an excluded dot dir. */
  linkNodeGypBuildMobileBin();
  process.stdout.write('[install-nodejs-project] done\n');
}

main();
