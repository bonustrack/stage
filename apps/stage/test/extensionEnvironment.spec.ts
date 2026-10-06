import { afterEach, describe, expect, test } from 'bun:test';
import { isBrowserExtension } from '../lib/extension.web';

const original = Object.getOwnPropertyDescriptor(globalThis, 'location');

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'location', original);
  else Reflect.deleteProperty(globalThis, 'location');
});

describe('extension-only browser behavior', () => {
  test.each(['https:', 'http:', 'stage-app:'])('keeps normal browser behavior on %s', (protocol) => {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol } });
    expect(isBrowserExtension()).toBe(false);
  });

  test('identifies only the extension origin', () => {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol: 'chrome-extension:' } });
    expect(isBrowserExtension()).toBe(true);
  });

  test('is safe outside a browser', () => {
    Reflect.deleteProperty(globalThis, 'location');
    expect(isBrowserExtension()).toBe(false);
  });
});
