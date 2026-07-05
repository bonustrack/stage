const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const sdkRequire = createRequire(require.resolve('@xmtp/browser-sdk'));
const walletRequire = createRequire(require.resolve('@railgun-community/wallet'));
const engineRequire = createRequire(walletRequire.resolve('@railgun-community/engine'));

function resolvePackageDir(pkg) {
  for (const req of [walletRequire, engineRequire, sdkRequire]) {
    try {
      return path.dirname(req.resolve(pkg));
    } catch {
      continue;
    }
  }
  throw new Error(`cannot resolve ${pkg}`);
}

function findWasm(pkg, file) {
  const dir = resolvePackageDir(pkg);
  const candidates = [
    path.join(dir, 'pkg-esm', file),
    path.join(dir, '..', 'pkg-esm', file),
    path.join(dir, file),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`wasm not found for ${pkg}: ${file}`);
  return found;
}

const files = [
  [findWasm('@xmtp/wasm-bindings', 'bindings_wasm_bg.wasm'), 'bindings_wasm_bg.wasm'],
  [findWasm('@railgun-community/poseidon-hash-wasm', 'poseidon_hash_wasm_bg.wasm'), 'poseidon_hash_wasm_bg.wasm'],
  [
    findWasm('@railgun-community/curve25519-scalarmult-wasm', 'curve25519_scalarmult_wasm_bg.wasm'),
    'curve25519_scalarmult_wasm_bg.wasm',
  ],
];

for (const [source, name] of files) {
  const target = path.join(__dirname, '..', 'public', name);
  fs.copyFileSync(source, target);
  console.log(`copied ${source} -> ${target}`);
}
