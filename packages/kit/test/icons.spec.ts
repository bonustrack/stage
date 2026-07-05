import { describe, expect, test } from 'bun:test';
import {
  HERO_ICON_DEFAULTS,
  heroIconPaths,
  iconStroke,
  iconStrokeWidth,
} from '../src/icons';

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

describe('iconStrokeWidth', () => {
  test('focused uses the active width', () => {
    expect(iconStrokeWidth(true)).toBe(HERO_ICON_DEFAULTS.activeStrokeWidth);
  });

  test('unfocused (false or undefined) uses the default width', () => {
    expect(iconStrokeWidth(false)).toBe(HERO_ICON_DEFAULTS.strokeWidth);
    expect(iconStrokeWidth(undefined)).toBe(HERO_ICON_DEFAULTS.strokeWidth);
  });
});

describe('heroIconPaths', () => {
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
