const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const sdkRequire = createRequire(require.resolve('@xmtp/browser-sdk'));
const bindingsDir = path.dirname(sdkRequire.resolve('@xmtp/wasm-bindings'));

function findWasm(file) {
  const candidates = [
    path.join(bindingsDir, 'pkg-esm', file),
    path.join(bindingsDir, '..', 'pkg-esm', file),
    path.join(bindingsDir, file),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`wasm not found: ${file}`);
  return found;
}

function servedWasmPath() {
  const glue = fs.readFileSync(path.join(bindingsDir, 'bindings_wasm.js'), 'utf8');
  const match = /module_or_path = '(\/wasm\/[^']+\.wasm)'/.exec(glue);
  if (!match) throw new Error('the @xmtp/wasm-bindings patch with the versioned wasm path is not applied');
  return match[1];
}

const source = findWasm('bindings_wasm_bg.wasm');
const served = servedWasmPath();
const publicDir = path.join(__dirname, '..', 'public');
fs.rmSync(path.join(publicDir, 'wasm'), { recursive: true, force: true });
const target = path.join(publicDir, ...served.split('/').filter(Boolean));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`copied ${source} -> ${target}`);
