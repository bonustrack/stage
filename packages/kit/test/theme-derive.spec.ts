import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SEED,
  accentHex,
  derivePalette,
  formulaPalette,
  grayscaleFromHex,
  grayscaleHex,
  type ThemeSeed,
} from '../src/theme-derive';
import { kitPalette } from '../src/tokens';

const CUSTOM: ThemeSeed = {
  accent: { primary: '#ff6600', level: 3 },
  grayscale: { hue: 210, tint: 4, shade: 1 },
  surface: { background: '#101820', foreground: '#c0c8d0' },
};

describe('derivePalette', () => {
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
    const noShade: ThemeSeed = { ...DEFAULT_SEED.dark, grayscale: { hue: 216, tint: 6 } };
    expect(derivePalette(noShade, 'dark')).toEqual(derivePalette(DEFAULT_SEED.dark, 'dark'));
  });

  test('custom seed derives a palette: snapshot', () => {
    expect(derivePalette(CUSTOM, 'dark')).toMatchSnapshot();
  });

  test('the default seed short-circuits to the legacy palette', () => {
    for (const scheme of ['dark', 'light'] as const) expect(derivePalette(DEFAULT_SEED[scheme], scheme)).toEqual(kitPalette(scheme));
  });

  test('the formula alone is not lossless at the default seed: sub and inputBg drift', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const legacy = kitPalette(scheme);
      expect(formulaPalette(DEFAULT_SEED[scheme], scheme)).toEqual({
        ...legacy,
        sub: scheme === 'dark' ? '#646568' : '#9ea2a8',
        inputBg: scheme === 'dark' ? '#1b1d1f' : '#f2f2f2',
      });
    }
  });

  test('any other seed goes through the formula', () => {
    expect(derivePalette(CUSTOM, 'dark')).toEqual(formulaPalette(CUSTOM, 'dark'));
  });
});

describe('ChatKit-shaped colour generators', () => {
  test('grayscale hue/tint/shade reproduces the legacy border exactly, not only via the short-circuit', () => {
    expect(grayscaleHex(DEFAULT_SEED.dark.grayscale, 'dark')).toBe(kitPalette('dark').border);
    expect(grayscaleHex(DEFAULT_SEED.light.grayscale, 'light')).toBe(kitPalette('light').border);
  });

  test('grayscaleFromHex round-trips the default greys', () => {
    expect(grayscaleFromHex(kitPalette('dark').border, 'dark')).toEqual(DEFAULT_SEED.dark.grayscale);
    expect(grayscaleFromHex(kitPalette('light').border, 'light')).toEqual(DEFAULT_SEED.light.grayscale);
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
