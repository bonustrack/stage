/* CODEGEN: emit the Railgun bridge method manifest the embedded Node host reads.
 *
 *  THE DESYNC FIX (phase 2): the bridge method names are enumerated ONCE in the
 *  pure client contract (packages/client/src/railgun/methods.ts SDK_METHODS).
 *  The Node host (nodejs-assets/nodejs-project) is a separate CJS project that
 *  CANNOT import the TS client at runtime, so we project the registry into a
 *  plain JSON manifest it can require. The host's sdkDispatch.js asserts its
 *  WHITELIST keys equal this manifest at load (assertWhitelistParity), and a
 *  test (test/railgunMethodParity.test.ts) re-asserts it in CI - so a method
 *  added to the contract but not the host (or vice-versa) FAILS the build
 *  instead of shipping a silent runtime gap on a real APK.
 *
 *  Run: `node apps/app/scripts/gen-railgun-methods.mjs`
 *  Output: apps/app/nodejs-assets/nodejs-project/railgun-methods.json
 *
 *  NOTE: this imports the TS source via a tiny inline re-export of the literal
 *  arrays so it needs no TS toolchain (the arrays are plain string literals). */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const methodsTs = resolve(here, '../../../packages/client/src/railgun/methods.ts');
const outFile = resolve(here, '../nodejs-assets/nodejs-project/railgun-methods.json');

/** Parse a `export const NAME = [ ... ] as const;` string-literal array out of
 *  the TS source by name. Pure-string-literal arrays only (no expressions), so a
 *  regex + literal extraction is safe and avoids needing a TS loader. */
function extractArray(src, name) {
  const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`);
  const m = src.match(re);
  if (!m) throw new Error(`gen-railgun-methods: could not find const ${name}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((g) => g[1]);
}

const src = readFileSync(methodsTs, 'utf8');
const manifest = {
  sdkMethods: extractArray(src, 'SDK_METHODS').sort(),
  engineOps: extractArray(src, 'ENGINE_OPS').sort(),
  compositeOps: extractArray(src, 'COMPOSITE_OPS').sort(),
  __generated: 'apps/app/scripts/gen-railgun-methods.mjs - do not edit by hand',
};

writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(
  `gen-railgun-methods: wrote ${manifest.sdkMethods.length} sdk + ` +
    `${manifest.engineOps.length} engine + ${manifest.compositeOps.length} composite to railgun-methods.json\n`,
);
