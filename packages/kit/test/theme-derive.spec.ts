import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SEED,
  assertDefaultLossless,
  derivePalette,
  type ThemeSeed,
} from '../src/theme-derive';

describe('derivePalette', () => {
  test('default seed returns the LEGACY palette (dark) — snapshot', () => {
    expect(derivePalette(DEFAULT_SEED.dark, 'dark')).toMatchSnapshot();
  });

  test('default seed returns the LEGACY palette (light) — snapshot', () => {
    expect(derivePalette(DEFAULT_SEED.light, 'light')).toMatchSnapshot();
  });

  test('default seed matches case-insensitively and returns a copy', () => {
    const upper: ThemeSeed = {
      grayscale: '#282A2D',
      accent: '#FFFFFF',
      surface: { background: '#0E0F10', foreground: '#9F9FA3' },
    };
    const a = derivePalette(upper, 'dark');
    const b = derivePalette(DEFAULT_SEED.dark, 'dark');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  test('custom seed derives a palette — snapshot', () => {
    const seed: ThemeSeed = {
      grayscale: '#334455',
      accent: '#ff6600',
      surface: { background: '#101820', foreground: '#c0c8d0' },
    };
    expect(derivePalette(seed, 'dark')).toMatchSnapshot();
  });

  test('assertDefaultLossless does not throw', () => {
    expect(() => assertDefaultLossless()).not.toThrow();
  });
});
