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
const marker = path.join(projDir, 'node_modules', '@railgun-community', 'wallet', 'package.json');

function main() {
  if (!fs.existsSync(path.join(projDir, 'package.json'))) {
    process.stdout.write('[install-nodejs-project] no nodejs-project — skipping\n');
    return;
  }
  if (fs.existsSync(marker)) {
    process.stdout.write('[install-nodejs-project] deps already installed — skipping\n');
    return;
  }
  process.stdout.write('[install-nodejs-project] installing embedded Node host deps…\n');
  execSync('npm install --no-audit --no-fund --loglevel=error', {
    cwd: projDir,
    stdio: 'inherit',
  });
  process.stdout.write('[install-nodejs-project] done\n');
}

main();
