import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entryOverBudget, webBundleSizes } from '../web-bundle-budget.mjs';

const dirs = [];

function exportWith(files) {
  const root = mkdtempSync(join(tmpdir(), 'stage-web-export-'));
  dirs.push(root);
  const js = join(root, '_expo', 'static', 'js', 'web');
  mkdirSync(js, { recursive: true });
  for (const [name, code] of Object.entries(files)) writeFileSync(join(js, name), code);
  return root;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('web bundle budget', () => {
  test('lists every script, largest gzip first, and skips source maps', () => {
    const root = exportWith({
      'entry-abc.js': Array.from({ length: 2000 }, (_, i) => `var v${i} = ${i * 7};`).join('\n'),
      'jsQR-def.js': 'small',
      'entry-abc.js.map': '{}',
    });
    const sizes = webBundleSizes(root);
    expect(sizes.map(({ file }) => file)).toEqual(['entry-abc.js', 'jsQR-def.js']);
    expect(sizes[0].bytes).toBeGreaterThan(sizes[0].gzip);
  });

  test('flags the entry only when its gzip size passes the budget', () => {
    const sizes = webBundleSizes(exportWith({ 'entry-abc.js': 'const a = 1;' }));
    expect(entryOverBudget(sizes, 1_000)).toBeNull();
    expect(entryOverBudget(sizes, 5)?.file).toBe('entry-abc.js');
  });

  test('an export without an entry bundle fails loudly', () => {
    expect(() => entryOverBudget(webBundleSizes(exportWith({ 'jsQR-def.js': 'small' })))).toThrow('no entry bundle');
  });
});
