/** @file Codegen projecting the client SDK_METHODS contract into railgun-methods.json so the CJS Node host stays in parity. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const methodsTs = resolve(here, '../../../packages/client/src/railgun/methods.ts');
const outFile = resolve(here, '../nodejs-assets/nodejs-project/railgun-methods.json');

/** Extract a named export const string-literal array from the TS source via regex (literal arrays only, no TS loader). */
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
