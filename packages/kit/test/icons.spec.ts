import { describe, expect, test } from 'bun:test';
import { heroIconPaths, iconStroke } from '../src/icons';

describe('iconStroke', () => {
  test('explicit color always wins', () => {
    expect(iconStroke('#ff0000', true)).toBe('#ff0000');
    expect(iconStroke('#ff0000', false)).toBe('#ff0000');
    expect(iconStroke('#ff0000', undefined)).toBe('#ff0000');
  });

  test('dark true -> white', () => {
    expect(iconStroke(undefined, true)).toBe('#ffffff');
  });

  test('dark false -> black', () => {
    expect(iconStroke(undefined, false)).toBe('#000000');
  });

  test('dark undefined -> currentColor', () => {
    expect(iconStroke(undefined, undefined)).toBe('currentColor');
  });
});

describe('heroIconPaths, kept for consumers of the icons subpath', () => {
  test('returns non-empty path arrays for known names', () => {
    for (const name of ['academicCap', 'bell', 'ban', 'arrowLeft'] as const) {
      const paths = heroIconPaths(name);
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) {
        expect(typeof d).toBe('string');
        expect(d.length).toBeGreaterThan(0);
      }
    }
  });

  test('multi-path glyphs keep all path segments', () => {
    expect(heroIconPaths('academicCap').length).toBeGreaterThan(1);
  });
});
