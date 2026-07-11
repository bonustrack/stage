
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');

const hooksSrc = read('app', '(conv)', 'conv.hooks.ts');
const webSeam = read('lib', 'xmtp.conv.web.ts');
const nativeSeam = read('lib', 'xmtp.conv.ts');
const screenSrc = read('app', '(conv)', '[convId].tsx');

describe('address-routed DM opening is resilient, never a silent dead end', () => {
  test('a failed create falls back to the existing local DM before anything else', () => {
    const catchIdx = hooksSrc.indexOf('catch (err)');
    const fallbackIdx = hooksSrc.indexOf('findExistingDmWithAddress(address)');
    const retryIdx = hooksSrc.indexOf('CREATE_RETRY_DELAY_MS));');
    const secondCreate = hooksSrc.lastIndexOf('return openDmWithAddress(address)');
    expect(catchIdx).toBeGreaterThanOrEqual(0);
    expect(fallbackIdx).toBeGreaterThan(catchIdx);
    expect(retryIdx).toBeGreaterThan(fallbackIdx);
    expect(secondCreate).toBeGreaterThan(retryIdx);
  });
  test('classification runs only after fallback AND retry both failed', () => {
    const resolveEnd = hooksSrc.indexOf('export function useResolvedConvId');
    const classifyIdx = hooksSrc.indexOf('dmUnreachableReason(param)');
    expect(classifyIdx).toBeGreaterThan(resolveEnd);
  });
  test('the error screen offers a retry, it is not terminal', () => {
    expect(hooksSrc).toContain('retry: () => void');
    expect(screenSrc).toContain('onPress={resolved.retry}');
  });
});

describe('dmUnreachableReason claims expired keys only with positive evidence', () => {
  const expectation = (src: string): void => {
    const statusesIdx = src.indexOf('const entries = [...statuses.values()]');
    const emptyGuard = src.indexOf('if (entries.length === 0) return null');
    const verdict = src.indexOf("entries.some(s => !s.validationError) ? null : 'stale-installations'");
    expect(statusesIdx).toBeGreaterThanOrEqual(0);
    expect(emptyGuard).toBeGreaterThan(statusesIdx);
    expect(verdict).toBeGreaterThan(emptyGuard);
  };
  test('web seam requires non-empty statuses before declaring stale', () => {
    expectation(webSeam);
  });
  test('native seam requires non-empty statuses before declaring stale', () => {
    expectation(nativeSeam);
  });
  test('both seams export the same findExistingDmWithAddress surface', () => {
    const sig = 'export async function findExistingDmWithAddress(address: string): Promise<string | null>';
    expect(webSeam).toContain(sig);
    expect(nativeSeam).toContain(sig);
  });
});
