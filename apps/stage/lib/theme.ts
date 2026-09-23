
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { secureStorage } from '../platform/storage';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@stage-labs/kit/theme';
import {
  semanticColors, kitPalette, type KitPalette,
} from '@stage-labs/kit/tokens';
import { derivePalette } from '@stage-labs/kit/theme-derive';
import { createValueStore } from './persistedStore';
import { useCustomTheme, useThemeSeeds } from './colorOverrides';

export {
  setCustomTheme, resetOverrides, seedColorHex,
  setSeedColor, setSeedDensity, setSeedRadius, setSeedBaseSize,
  setAccentLevel, setGrayscaleTint, setGrayscaleShade,
  type SeedColorKey,
} from './colorOverrides';

export { useCustomTheme, useThemeSeeds };

export type { ThemePreference };

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
