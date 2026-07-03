
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projDir = path.resolve(__dirname, '..', 'nodejs-assets', 'nodejs-project');
const appDir = path.resolve(__dirname, '..');
const marker = path.join(projDir, 'node_modules', '@railgun-community', 'wallet', 'package.json');

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
      fs.copyFileSync(target, linkPath);
    }
    try { fs.chmodSync(target, 0o755); } catch {}
    process.stdout.write('[install-nodejs-project] linked .bin/' + name + '\n');
  }
}

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
      if (ent.isSymbolicLink()) {
        try { fs.rmSync(full, { force: true }); removed++; } catch {}
        continue;
      }
      if (ent.name.startsWith('.')) {
        try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch {}
        continue;
      }
      if (ent.isDirectory()) {
        if (ent.name.startsWith('_')) {
          try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch {}
          continue;
        }
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

function patchUrlPatternForNoICU() {
  const nm = path.join(projDir, 'node_modules');
  if (!fs.existsSync(nm)) return;
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
  pruneForAssetBundling();
  patchUrlPatternForNoICU();
  linkNodeGypBuildMobileBin();
  process.stdout.write('[install-nodejs-project] done\n');
}

main();
