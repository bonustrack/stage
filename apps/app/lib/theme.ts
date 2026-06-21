
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
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
import {
  getRadius, getBlockRadius, loadRadius,
  subscribe as subscribeRadius,
} from './radiusOverride';

export {
  setCustomTheme, resetOverrides,
  setSeedColor, setSeedDensity, setSeedRadius, setSeedBaseSize,
  type SeedColorKey,
} from './colorOverrides';
export { useCustomTheme } from './useCustomTheme';

export function useThemeSeeds(): import('./colorOverrides').ThemeSeeds {
  const [s, setS] = useState(getSeeds());
  useEffect(() => {
    loadOverrides();
    setS(getSeeds());
    const unsub = subscribeOverrides(() => { setS(getSeeds()); });
    return unsub;
  }, []);
  return s;
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
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    if (isThemePreference(v)) emit(v);
  } catch { }
}

export async function setThemePreference(p: ThemePreference): Promise<void> {
  if (!isThemePreference(p)) return;
  emit(p);
  try { await SecureStore.setItemAsync(STORAGE_KEY, p); } catch { }
}

export function useThemePreference(): ThemePreference {
  const [pref, setPref] = useState<ThemePreference>(cached);
  useEffect(() => {
    void ensureLoaded();
    const fn = (p: ThemePreference): void => { setPref(p); };
    listeners.add(fn);
    return (): void => { listeners.delete(fn); };
  }, []);
  return pref;
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

function useOverridesVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    loadOverrides();
    loadRadius();
    const bump = (): void => { setV((n) => n + 1); };
    const unsubColors = subscribeOverrides(bump);
    const unsubRadius = subscribeRadius(() => { setDefaultButtonRadius(getRadius()); bump(); });
    setDefaultButtonRadius(getRadius());
    return () => { unsubColors(); unsubRadius(); };
  }, []);
  return v;
}

export function useRadius(): number {
  const [r, setR] = useState(getRadius());
  useEffect(() => {
    loadRadius();
    setDefaultButtonRadius(getRadius());
    setR(getRadius());
    const unsub = subscribeRadius(() => {
      setDefaultButtonRadius(getRadius());
      setR(getRadius());
    });
    return unsub;
  }, []);
  return r;
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
  const [r, setR] = useState(getBlockRadius());
  useEffect(() => {
    loadRadius();
    setR(getBlockRadius());
    const unsub = subscribeRadius(() => { setR(getBlockRadius()); });
    return unsub;
  }, []);
  return r;
}

export function usePalette(): Palette {
  const scheme = useEffectiveColorScheme();
  const version = useOverridesVersion();
  return useMemo(() => {
    if (isCustomTheme()) {
      const d = derivePalette(getSeeds()[scheme], scheme);
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
  }, [scheme, version]);
}
