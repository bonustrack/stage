
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { secureStorage } from '../platform/storage';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@stage-labs/kit/theme';
import {
  semanticColors, semanticPalette,
} from '@stage-labs/kit/tokens';
import { setDefaultButtonRadius } from '@stage-labs/kit/react-native/button';
import {
  getSeeds, loadOverrides, isCustomTheme,
  subscribe as subscribeOverrides,
} from './colorOverrides';
import { derivePalette } from '@stage-labs/kit/theme-derive';
import { useStoreValue } from './storeCore';
import {
  getRadius, getBlockRadius, loadRadius,
  subscribe as subscribeRadius,
} from './radiusOverride';

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
const listeners = new Set<(p: ThemePreference) => void>();

function emit(p: ThemePreference): void {
  cached = p;
  for (const l of listeners) l(p);
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

function subscribeThemePreference(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getThemePreference(): ThemePreference { return cached; }

function primeThemePreference(): void { void ensureLoaded(); }

export function useThemePreference(): ThemePreference {
  return useStoreValue(subscribeThemePreference, getThemePreference, primeThemePreference);
}

export function useEffectiveColorScheme(): 'light' | 'dark' {
  const pref = useThemePreference();
  const sys = useColorScheme();
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return sys === 'dark' ? 'dark' : 'light';
}

export interface Palette {
  bg: string; border: string; text: string; sub: string; link: string;
  primary: string; danger: string; success: string;
  inputBg: string; toolbarBg: string;
}


function primeRadius(): void {
  loadRadius();
  setDefaultButtonRadius(getRadius());
}

function subscribeButtonRadius(cb: () => void): () => void {
  return subscribeRadius(() => { setDefaultButtonRadius(getRadius()); cb(); });
}

export function useRadius(): number {
  return useStoreValue(subscribeButtonRadius, getRadius, primeRadius);
}

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

export function useBlockRadius(): number {
  return useStoreValue(subscribeRadius, getBlockRadius, loadRadius);
}

export function usePalette(): Palette {
  const scheme = useEffectiveColorScheme();
  const custom = useCustomTheme();
  const seeds = useThemeSeeds();
  useRadius();
  return useMemo(() => {
    if (custom) {
      const d = derivePalette(seeds[scheme], scheme);
      return {
        bg: d.bg, border: d.border, text: d.text, sub: d.sub, link: d.link,
        primary: d.primary, danger: d.danger, success: d.success,
        inputBg: d.inputBg, toolbarBg: d.toolbarBg,
      };
    }
    const s = semanticPalette(scheme);
    return {
      bg: s.bgColor, border: s.borderColor, text: s.textColor, sub: s.subColor,
      link: s.linkColor, primary: s.primaryColor,
      danger: s.dangerColor, success: s.successColor,
      inputBg: s.inputBgColor, toolbarBg: s.toolbarBgColor,
    };
  }, [scheme, custom, seeds]);
}
