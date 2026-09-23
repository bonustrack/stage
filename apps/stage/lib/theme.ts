
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
import {
  getSeeds, loadOverrides, isCustomTheme,
  subscribe as subscribeOverrides,
} from './colorOverrides';
import { derivePalette } from '@stage-labs/kit/theme-derive';
import { makeListeners, useStoreValue } from './storeCore';

export {
  setCustomTheme, resetOverrides, seedColorHex,
  setSeedColor, setSeedDensity, setSeedRadius, setSeedBaseSize,
  setAccentLevel, setGrayscaleTint, setGrayscaleShade,
  type SeedColorKey,
} from './colorOverrides';

export function useThemeSeeds(): import('./colorOverrides').ThemeSeeds {
  return useStoreValue(subscribeOverrides, getSeeds, loadOverrides);
}

export function useCustomTheme(): boolean {
  return useStoreValue(subscribeOverrides, isCustomTheme, loadOverrides);
}

export type { ThemePreference };

export const DANGER = semanticColors.dangerColor.dark;
export const SUCCESS = semanticColors.successColor.dark;

let cached: ThemePreference = 'system';
let loaded = false;
const listeners = makeListeners<ThemePreference>();

function emit(p: ThemePreference): void {
  cached = p;
  listeners.notify(p);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const v = await secureStorage.get(STORAGE_KEY);
    if (isThemePreference(v)) emit(v);
  } catch { }
}

export async function setThemePreference(p: ThemePreference): Promise<void> {
  if (!isThemePreference(p)) return;
  emit(p);
  try { await secureStorage.set(STORAGE_KEY, p); } catch { }
}

function getThemePreference(): ThemePreference { return cached; }

function primeThemePreference(): void { void ensureLoaded(); }

export function useThemePreference(): ThemePreference {
  return useStoreValue(listeners.subscribe, getThemePreference, primeThemePreference);
}

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
