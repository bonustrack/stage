const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const sdkRequire = createRequire(require.resolve('@xmtp/browser-sdk'));

function findWasm(pkg, file) {
  const dir = path.dirname(sdkRequire.resolve(pkg));
  const candidates = [
    path.join(dir, 'pkg-esm', file),
    path.join(dir, '..', 'pkg-esm', file),
    path.join(dir, file),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`wasm not found for ${pkg}: ${file}`);
  return found;
}

const source = findWasm('@xmtp/wasm-bindings', 'bindings_wasm_bg.wasm');
const target = path.join(__dirname, '..', 'public', 'bindings_wasm_bg.wasm');
fs.copyFileSync(source, target);
console.log(`copied ${source} -> ${target}`);
