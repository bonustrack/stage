
export type { Scheme } from './tokens';
import type { Scheme } from './tokens';
import { hexToHsl, hslToHex } from './color-math';

export type AccentLevel = 0 | 1 | 2 | 3;
export type GrayscaleTint = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type GrayscaleShade = -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4;

export interface AccentColor {
  primary: string;
  level: AccentLevel;
}

export interface GrayscaleOptions {
  hue: number;
  tint: GrayscaleTint;
  shade?: GrayscaleShade;
}

export interface SurfaceColors {
  background: string;
  foreground: string;
}

export interface ThemeSeed {
  accent: AccentColor;
  grayscale: GrayscaleOptions;
  surface: SurfaceColors;
}

export interface DerivedPalette {
  bg: string; border: string; text: string; sub: string; link: string;
  primary: string; danger: string; success: string;
  inputBg: string; toolbarBg: string;
}

export const DANGER_FIXED = '#eb4c5b';
export const SUCCESS_FIXED = '#57b375';

export const ACCENT_LEVEL_DEFAULT: AccentLevel = 3;

const GRAYSCALE_BASE_L: Record<Scheme, number> = { dark: 0.167, light: 0.896 };
const TINT_STEP = 0.01;
const SHADE_STEP = 0.03;
const ACCENT_MUTE_STEP = 0.18;

function clamp255(n: number): number { return n < 0 ? 0 : n > 255 ? 255 : Math.round(n); }

function clampRange(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n))) || 0;
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  const h = m?.[1];
  if (h === undefined) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  const h = (n: number): string => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a); const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

export function grayscaleHex(g: GrayscaleOptions, scheme: Scheme): string {
  const base = GRAYSCALE_BASE_L[scheme];
  return hslToHex(g.hue, g.tint * TINT_STEP, base - (g.shade ?? 0) * SHADE_STEP);
}

export function grayscaleFromHex(hex: string, scheme: Scheme): GrayscaleOptions {
  const { h, s, l } = hexToHsl(hex);
  return {
    hue: clampRange(h, 0, 360),
    tint: clampRange(s / TINT_STEP, 0, 9) as GrayscaleTint,
    shade: clampRange((GRAYSCALE_BASE_L[scheme] - l) / SHADE_STEP, -4, 4) as GrayscaleShade,
  };
}

export function accentHex(a: AccentColor, surfaceForeground: string): string {
  return mix(a.primary, surfaceForeground, (ACCENT_LEVEL_DEFAULT - a.level) * ACCENT_MUTE_STEP);
}

export const DEFAULT_SEED: Record<Scheme, ThemeSeed> = {
  dark: {
    accent: { primary: '#ffffff', level: ACCENT_LEVEL_DEFAULT },
    grayscale: { hue: 216, tint: 6, shade: 0 },
    surface: { background: '#0e0f10', foreground: '#9f9fa3' },
  },
  light: {
    accent: { primary: '#000000', level: ACCENT_LEVEL_DEFAULT },
    grayscale: { hue: 240, tint: 2, shade: 0 },
    surface: { background: '#ffffff', foreground: '#57606a' },
  },
};

const BORDER_RATIO = 1;

const INPUT_BG_RATIO: Record<Scheme, number> = {
  dark: 0.5,
  light: 0.5,
};

const SUB_RATIO: Record<Scheme, number> = {
  dark: 0.5,
  light: 0.5,
};

const LEGACY: Record<Scheme, DerivedPalette> = {
  dark: {
    bg: '#0e0f10', border: '#282a2d', text: '#9f9fa3', sub: '#7a7a7e',
    link: '#ffffff', primary: '#ffffff', danger: DANGER_FIXED, success: SUCCESS_FIXED,
    inputBg: '#1c1d1f', toolbarBg: '#0e0f10',
  },
  light: {
    bg: '#ffffff', border: '#e4e4e5', text: '#57606a', sub: '#8a929d',
    link: '#000000', primary: '#000000', danger: DANGER_FIXED, success: SUCCESS_FIXED,
    inputBg: '#f2f2f3', toolbarBg: '#ffffff',
  },
};

function grayscaleEquals(a: GrayscaleOptions, b: GrayscaleOptions): boolean {
  return a.hue === b.hue && a.tint === b.tint && (a.shade ?? 0) === (b.shade ?? 0);
}

function seedEquals(a: ThemeSeed, b: ThemeSeed): boolean {
  return a.accent.primary.toLowerCase() === b.accent.primary.toLowerCase()
    && a.accent.level === b.accent.level
    && grayscaleEquals(a.grayscale, b.grayscale)
    && a.surface.background.toLowerCase() === b.surface.background.toLowerCase()
    && a.surface.foreground.toLowerCase() === b.surface.foreground.toLowerCase();
}

export function derivePalette(seed: ThemeSeed, scheme: Scheme): DerivedPalette {
  if (seedEquals(seed, DEFAULT_SEED[scheme])) return { ...LEGACY[scheme] };

  const bg = seed.surface.background;
  const text = seed.surface.foreground;
  const gray = grayscaleHex(seed.grayscale, scheme);
  const accent = accentHex(seed.accent, text);
  return {
    bg,
    border: mix(bg, gray, BORDER_RATIO),
    text,
    sub: mix(text, gray, SUB_RATIO[scheme]),
    link: accent,
    primary: accent,
    danger: DANGER_FIXED,
    success: SUCCESS_FIXED,
    inputBg: mix(bg, gray, INPUT_BG_RATIO[scheme]),
    toolbarBg: bg,
  };
}

export function assertDefaultLossless(): void {
  for (const scheme of ['dark', 'light'] as const) {
    const got = derivePalette(DEFAULT_SEED[scheme], scheme);
    const want = LEGACY[scheme];
    for (const k of Object.keys(want) as (keyof DerivedPalette)[]) {
      if (got[k].toLowerCase() !== want[k].toLowerCase()) {
        throw new Error(`theme-derive default not lossless: ${scheme}.${k} ${got[k]} != ${want[k]}`);
      }
    }
  }
}
