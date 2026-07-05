const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const sdkRequire = createRequire(require.resolve('@xmtp/browser-sdk'));
const source = path.join(
  path.dirname(sdkRequire.resolve('@xmtp/wasm-bindings')),
  'bindings_wasm_bg.wasm',
);
const target = path.join(__dirname, '..', 'public', 'bindings_wasm_bg.wasm');

fs.copyFileSync(source, target);
console.log(`copied ${source} -> ${target}`);
