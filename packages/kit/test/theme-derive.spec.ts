import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SEED,
  assertDefaultLossless,
  accentHex,
  derivePalette,
  grayscaleFromHex,
  grayscaleHex,
  type ThemeSeed,
} from '../src/theme-derive';

const CUSTOM: ThemeSeed = {
  accent: { primary: '#ff6600', level: 3 },
  grayscale: { hue: 210, tint: 4, shade: 1 },
  surface: { background: '#101820', foreground: '#c0c8d0' },
};

describe('derivePalette', () => {
  test('default seed returns the LEGACY palette (dark) — snapshot', () => {
    expect(derivePalette(DEFAULT_SEED.dark, 'dark')).toMatchSnapshot();
  });

  test('default seed returns the LEGACY palette (light) — snapshot', () => {
    expect(derivePalette(DEFAULT_SEED.light, 'light')).toMatchSnapshot();
  });

  test('default seed matches case-insensitively and returns a copy', () => {
    const upper: ThemeSeed = {
      accent: { primary: '#FFFFFF', level: 3 },
      grayscale: { hue: 216, tint: 6, shade: 0 },
      surface: { background: '#0E0F10', foreground: '#9F9FA3' },
    };
    const a = derivePalette(upper, 'dark');
    const b = derivePalette(DEFAULT_SEED.dark, 'dark');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  test('omitted shade is treated as 0 by the default short-circuit', () => {
    const noShade: ThemeSeed = {
      ...DEFAULT_SEED.dark,
      grayscale: { hue: 216, tint: 6 },
    };
    expect(derivePalette(noShade, 'dark')).toEqual(derivePalette(DEFAULT_SEED.dark, 'dark'));
  });

  test('custom seed derives a palette — snapshot', () => {
    expect(derivePalette(CUSTOM, 'dark')).toMatchSnapshot();
  });

  test('assertDefaultLossless does not throw', () => {
    expect(() => assertDefaultLossless()).not.toThrow();
  });
});

describe('ChatKit-shaped colour generators', () => {
  test('grayscale hue/tint/shade reproduces the legacy border exactly, not only via the short-circuit', () => {
    expect(grayscaleHex(DEFAULT_SEED.dark.grayscale, 'dark')).toBe('#282a2d');
    expect(grayscaleHex(DEFAULT_SEED.light.grayscale, 'light')).toBe('#e4e4e5');
  });

  test('grayscaleFromHex round-trips the default greys', () => {
    expect(grayscaleFromHex('#282a2d', 'dark')).toEqual({ hue: 216, tint: 6, shade: 0 });
    expect(grayscaleFromHex('#e4e4e5', 'light')).toEqual({ hue: 240, tint: 2, shade: 0 });
  });

  test('negative shade lightens and positive shade darkens', () => {
    const red = (hex: string): number => Number.parseInt(hex.slice(1, 3), 16);
    const base = red(grayscaleHex({ hue: 216, tint: 6, shade: 0 }, 'dark'));
    expect(red(grayscaleHex({ hue: 216, tint: 6, shade: -4 }, 'dark'))).toBeGreaterThan(base);
    expect(red(grayscaleHex({ hue: 216, tint: 6, shade: 4 }, 'dark'))).toBeLessThan(base);
  });

  test('tint 0 produces a pure neutral', () => {
    const hex = grayscaleHex({ hue: 216, tint: 0, shade: 0 }, 'dark');
    expect(hex.slice(1, 3)).toBe(hex.slice(3, 5));
    expect(hex.slice(3, 5)).toBe(hex.slice(5, 7));
  });

  test('accent level 3 is the primary unchanged; lower levels mute toward the foreground', () => {
    expect(accentHex({ primary: '#ffffff', level: 3 }, '#9f9fa3')).toBe('#ffffff');
    expect(accentHex({ primary: '#ffffff', level: 0 }, '#9f9fa3')).not.toBe('#ffffff');
  });
});
