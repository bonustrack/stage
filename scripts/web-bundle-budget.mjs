import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const ENTRY_GZIP_BUDGET = 1_600_000;

const WEB_JS_DIR = ['_expo', 'static', 'js', 'web'];

export function webBundleSizes(exportDir) {
  const dir = join(exportDir, ...WEB_JS_DIR);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const code = readFileSync(join(dir, file));
      return { file, bytes: code.length, gzip: gzipSync(code, { level: 9 }).length };
    })
    .sort((a, b) => b.gzip - a.gzip);
}

export function entryOverBudget(sizes, budget = ENTRY_GZIP_BUDGET) {
  const entry = sizes.find(({ file }) => file.startsWith('entry-'));
  if (entry === undefined) throw new Error('The web export has no entry bundle');
  return entry.gzip > budget ? entry : null;
}

const kb = (bytes) => Math.round(bytes / 1024).toLocaleString('en-US');

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const sizes = webBundleSizes(process.argv[2] ?? 'dist');
  for (const { file, bytes, gzip } of sizes) console.log(`${file}: ${kb(bytes)} KB, ${kb(gzip)} KB gzip`);
  const over = entryOverBudget(sizes);
  if (over !== null) {
    console.error(`${over.file} is ${kb(over.gzip)} KB gzip, over the ${kb(ENTRY_GZIP_BUDGET)} KB budget in scripts/web-bundle-budget.mjs`);
    process.exit(1);
  }
}
