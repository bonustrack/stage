const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..');
const outDir = path.join(appDir, 'public', 'privy');
const entry = path.join(appDir, 'components', 'privy', 'standalone.web.tsx');

const OPTIONAL_PEERS = [
  '@solana/kit',
  '@solana-program/system',
  '@solana-program/token',
  '@solana-program/memo',
  '@farcaster/mini-app-solana',
  '@abstract-foundation/agw-client',
  'permissionless',
];

function isInstalled(name) {
  try {
    require.resolve(`${name}/package.json`, { paths: [appDir] });
    return true;
  } catch {
    return false;
  }
}

function escapeForPattern(name) {
  return name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

const missing = OPTIONAL_PEERS.filter((name) => !isInstalled(name));
const missingPeers = new RegExp(`^(${missing.map(escapeForPattern).join('|')})(/.*)?$`);

const absentPeers = {
  name: 'absent-optional-peers',
  setup(build) {
    if (missing.length === 0) return;
    build.onResolve({ filter: missingPeers }, (args) => ({ path: args.path, namespace: 'absent-peer' }));
    build.onLoad({ filter: /.*/, namespace: 'absent-peer' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: true,
    naming: { entry: 'runtime.js', chunk: 'chunk-[hash].js', asset: 'asset-[hash].[ext]' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [absentPeers],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  const bytes = result.outputs.reduce((total, output) => total + output.size, 0);
  console.log(`built the Privy runtime: ${result.outputs.length} files, ${Math.round(bytes / 1024)} KB -> ${outDir}`);
}

void main();
