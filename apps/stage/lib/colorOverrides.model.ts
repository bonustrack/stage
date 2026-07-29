
import {
  DEFAULT_SEED, grayscaleFromHex, grayscaleHex,
  type ThemeSeed, type Scheme, type AccentLevel, type GrayscaleShade, type GrayscaleTint,
  type RadiusName, type Density, type BaseSize,
  RADIUS_NAME_DEFAULT, DENSITY_DEFAULT, BASE_SIZE_DEFAULT,
} from '@stage-labs/kit';

export interface ThemeSeeds {
  light: ThemeSeed;
  dark: ThemeSeed;
  density: Density;
  radius: RadiusName;
  baseSize: BaseSize;
}

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function isHex(v: string): boolean { return HEX_RE.test(v.trim()); }

export function cloneSeed(s: ThemeSeed): ThemeSeed {
  return {
    accent: { ...s.accent },
    grayscale: { ...s.grayscale },
    surface: { ...s.surface },
  };
}

export function defaultSeeds(): ThemeSeeds {
  return {
    light: cloneSeed(DEFAULT_SEED.light),
    dark: cloneSeed(DEFAULT_SEED.dark),
    density: DENSITY_DEFAULT,
    radius: RADIUS_NAME_DEFAULT,
    baseSize: BASE_SIZE_DEFAULT,
  };
}

function hex(v: unknown, fallback: string): string {
  return typeof v === 'string' && isHex(v) ? v.trim().toLowerCase() : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function migrateAccent(raw: unknown, fallback: ThemeSeed['accent']): ThemeSeed['accent'] {
  if (typeof raw === 'string') return { primary: hex(raw, fallback.primary), level: fallback.level };
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  const level = num(o.level, fallback.level);
  return {
    primary: hex(o.primary, fallback.primary),
    level: Math.min(3, Math.max(0, Math.round(level))) as AccentLevel,
  };
}

function migrateGrayscale(
  raw: unknown, scheme: Scheme, fallback: ThemeSeed['grayscale'],
): ThemeSeed['grayscale'] {
  if (typeof raw === 'string' && isHex(raw)) return grayscaleFromHex(raw, scheme);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    hue: num(o.hue, fallback.hue),
    tint: num(o.tint, fallback.tint) as GrayscaleTint,
    shade: num(o.shade, fallback.shade ?? 0) as GrayscaleShade,
  };
}

function migrateSurface(raw: unknown, fallback: ThemeSeed['surface']): ThemeSeed['surface'] {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    background: hex(o.background, fallback.background),
    foreground: hex(o.foreground, fallback.foreground),
  };
}

function migrateSeed(raw: unknown, scheme: Scheme): ThemeSeed {
  const fallback = DEFAULT_SEED[scheme];
  if (!raw || typeof raw !== 'object') return cloneSeed(fallback);
  const o = raw as Record<string, unknown>;
  return {
    accent: migrateAccent(o.accent, fallback.accent),
    grayscale: migrateGrayscale(o.grayscale, scheme, fallback.grayscale),
    surface: migrateSurface(o.surface, fallback.surface),
  };
}

export function migrateSeeds(raw: unknown): ThemeSeeds {
  const base = defaultSeeds();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    ...o,
    light: migrateSeed(o.light, 'light'),
    dark: migrateSeed(o.dark, 'dark'),
  };
}

export type SeedColorKey = 'grayscale' | 'accent' | 'background' | 'foreground';

export function seedColorHex(seeds: ThemeSeeds, scheme: Scheme, key: SeedColorKey): string {
  const seed = seeds[scheme];
  if (key === 'background') return seed.surface.background;
  if (key === 'foreground') return seed.surface.foreground;
  if (key === 'accent') return seed.accent.primary;
  return grayscaleHex(seed.grayscale, scheme);
}
