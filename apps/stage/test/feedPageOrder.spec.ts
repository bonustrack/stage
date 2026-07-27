import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');

const nativeSeam = read('lib', 'xmtp.messages.ts');
const webSeam = read('lib', 'xmtp.messages.web.ts');

const SHARED_DIR = join(APP_ROOT, 'modules', 'messaging');
const sharedModules = readdirSync(SHARED_DIR)
  .filter(f => f.endsWith('.ts'))
  .map(f => ({ file: f, src: readFileSync(join(SHARED_DIR, f), 'utf8') }));

describe('feed pages are newest-first on both platforms', () => {
  test('both seams expose latestConvMessages', () => {
    for (const src of [nativeSeam, webSeam]) {
      expect(src).toContain('export async function latestConvMessages(');
      expect(src).toContain('conv: ConvHandle, line: string, limit: number,');
    }
  });

  test('the native seam asks for DESCENDING instead of trusting the default', () => {
    expect(nativeSeam).toContain("await conv.messages({ limit, direction: 'DESCENDING' })");
  });

  test('the web seam asks for Descending and passes a bigint limit', () => {
    expect(webSeam).toContain(
      'await conv.messages({ limit: BigInt(limit), direction: SortDirection.Descending })',
    );
  });

  test('every web message read is explicit about direction', () => {
    const calls = webSeam.match(/\.messages\(\{[^}]*\}/gs) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toContain('SortDirection.Descending');
  });
});

describe('shared messaging code never reads messages off a raw sdk conversation', () => {
  test('no platform-neutral module calls conv.messages directly', () => {
    for (const { file, src } of sharedModules) {
      expect([file, /\bconv\.messages\(|\bfresh\.messages\(/.test(src)]).toEqual([file, false]);
    }
  });

  test('the feed query and reconciler page through the seam', () => {
    const feedQuery = sharedModules.find(m => m.file === 'feedQuery.ts')?.src ?? '';
    const reconcile = sharedModules.find(m => m.file === 'feedReconcile.ts')?.src ?? '';
    expect(feedQuery).toContain('latestConvMessages(conv, line, PAGE_SIZE)');
    expect(feedQuery).toContain('latestConvMessages(fresh, line, PAGE_SIZE)');
    expect(reconcile).toContain('latestConvMessages(conv, line, 1)');
    expect(reconcile).toContain('latestConvMessages(conv, line, PAGE_SIZE)');
  });
});
