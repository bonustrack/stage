import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { secureStorage } from '../platform/storage';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@stage-labs/kit/theme';
import {
  semanticColors, kitPalette, type KitPalette, type Scheme, type RadiusName, type Density, type BaseSize,
} from '@stage-labs/kit/tokens';
import {
  derivePalette, grayscaleFromHex,
  type ThemeSeed, type AccentLevel,
  type GrayscaleShade, type GrayscaleTint,
} from '@stage-labs/kit/theme-derive';
import { createValueStore } from './persistedStore';
import {
  cloneSeed, defaultSeeds, migrateSeeds,
  type SeedColorKey, type ThemeSeeds,
} from './colorOverrides.model';

export type { ThemePreference, SeedColorKey };
export { isHex, seedColorHex } from './colorOverrides.model';

export const DANGER = semanticColors.dangerColor.dark;
export const SUCCESS = semanticColors.successColor.dark;

const preference = createValueStore<ThemePreference>({
  key: STORAGE_KEY,
  default: 'system',
  storage: secureStorage,
  deserialize: (raw) => (isThemePreference(raw) ? raw : undefined),
});

export async function setThemePreference(p: ThemePreference): Promise<void> {
  if (!isThemePreference(p)) return;
  await preference.setAsync(p);
}

export const useThemePreference = (): ThemePreference => preference.use();

export function useEffectiveColorScheme(): 'light' | 'dark' {
  const pref = useThemePreference();
  const sys = useColorScheme();
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return sys === 'dark' ? 'dark' : 'light';
}

export type Palette = KitPalette;


export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (hex) {
    let h = hex[1] ?? '';
    if (h.length === 3) {
      h = Array.from(h, (ch) => ch + ch).join('');
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color.trim());
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  return color;
}

export function usePalette(): Palette {
  const scheme = useEffectiveColorScheme();
  const custom = useCustomTheme();
  const seeds = useThemeSeeds();
  return useMemo(() => {
    if (custom) return { ...derivePalette(seeds[scheme], scheme) };
    return kitPalette(scheme);
  }, [scheme, custom, seeds]);
}

function parseSeeds(raw: string): ThemeSeeds | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? migrateSeeds(parsed) : undefined;
  } catch { return undefined; }
}

const seeds = createValueStore<ThemeSeeds>({
  key: 'theme:seed', default: defaultSeeds(), serialize: (v) => JSON.stringify(v), deserialize: parseSeeds,
});

const custom = createValueStore<boolean>({
  key: 'theme:custom', default: false, serialize: (on) => (on ? '1' : '0'), deserialize: (raw) => raw === '1',
});

export const useThemeSeeds = (): ThemeSeeds => seeds.use();

export const useCustomTheme = (): boolean => custom.use();

export function setCustomTheme(on: boolean): void { custom.set(on); }

function patchSeeds(patch: Partial<ThemeSeeds>): void {
  seeds.set({ ...seeds.get(), ...patch });
}

function commit(scheme: Scheme, seed: ThemeSeed): void {
  seeds.set({ ...seeds.get(), [scheme]: seed });
}

export function setSeedColor(scheme: Scheme, key: SeedColorKey, hex: string): void {
  const v = hex.trim().toLowerCase();
  if (!/^#([0-9a-f]{6})$/.test(v)) return;
  const seed = cloneSeed(seeds.get()[scheme]);
  if (key === 'background') seed.surface.background = v;
  else if (key === 'foreground') seed.surface.foreground = v;
  else if (key === 'accent') seed.accent.primary = v;
  else seed.grayscale = grayscaleFromHex(v, scheme);
  commit(scheme, seed);
}

export function setAccentLevel(scheme: Scheme, level: AccentLevel): void {
  const seed = cloneSeed(seeds.get()[scheme]);
  seed.accent.level = level;
  commit(scheme, seed);
}

export function setGrayscaleTint(scheme: Scheme, tint: GrayscaleTint): void {
  const seed = cloneSeed(seeds.get()[scheme]);
  seed.grayscale.tint = tint;
  commit(scheme, seed);
}

export function setGrayscaleShade(scheme: Scheme, shade: GrayscaleShade): void {
  const seed = cloneSeed(seeds.get()[scheme]);
  seed.grayscale.shade = shade;
  commit(scheme, seed);
}

export function setSeedDensity(density: Density): void { patchSeeds({ density }); }

export function setSeedRadius(radius: RadiusName): void { patchSeeds({ radius }); }

export function setSeedBaseSize(baseSize: BaseSize): void { patchSeeds({ baseSize }); }

export function resetOverrides(): void { seeds.set(defaultSeeds()); }
