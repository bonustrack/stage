/** App-wide theme preference: 'light' | 'dark' | 'system'.
 *  Persisted in expo-secure-store under `app.theme`. A tiny module-level
 *  pub/sub keeps every mounted screen in sync the moment the user toggles
 *  the choice on the Settings screen — without spinning up a full context
 *  provider just for one string. */

import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@metro-labs/kit/theme';
import {
  semanticColors, semanticPalette, kitTheme,
  type KitTheme, type KitThemeOptions,
  type RadiusName, type Density, type BaseSize,
} from '@metro-labs/kit/tokens';
import { setDefaultButtonRadius } from '@metro-labs/kit/button';
import {
  getOverrides, loadOverrides, isCustomTheme,
  subscribe as subscribeOverrides, type TokenKey,
} from './colorOverrides';
import {
  getRadius, getBlockRadius, loadRadius,
  subscribe as subscribeRadius,
} from './radiusOverride';

export { setRadius, setBlockRadius, resetRadius } from './radiusOverride';
export { setCustomTheme } from './colorOverrides';
export { useCustomTheme } from './useCustomTheme';

export type { ThemePreference };

/** ChatKit-shaped theme alignment (PR1), re-exported from the kit tokens so the
 *  app imports them from one place. Additive only: existing usePalette consumers
 *  are untouched. ChatKit `accent` maps to our `link` (NOT `primary`). */
export { kitTheme };
export type { KitTheme, KitThemeOptions, RadiusName, Density, BaseSize };

/** Scheme-independent semantic constants (same hex in dark + light) for the
 *  many sub-components that take a `dark` prop instead of the full palette.
 *  Sourced from the kit tokens — no app-local fork. */
export const DANGER = semanticColors.dangerColor.dark;
export const SUCCESS = semanticColors.successColor.dark;

/** Cached preference — populated on first hook mount from SecureStore. Subsequent reads
 *  return synchronously so screens never flash the wrong theme. */
let cached: ThemePreference = 'system';
let loaded = false;
const listeners = new Set<(p: ThemePreference) => void>();

function emit(p: ThemePreference): void {
  cached = p;
  for (const l of listeners) l(p);
}

/** Read the persisted preference once. Subsequent calls are no-ops. */
async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    if (isThemePreference(v)) emit(v);
  } catch { /* fall back to 'system' default */ }
}

/** Persist + broadcast a new theme preference. */
export async function setThemePreference(p: ThemePreference): Promise<void> {
  if (!isThemePreference(p)) return;
  emit(p);
  try { await SecureStore.setItemAsync(STORAGE_KEY, p); } catch { /* best-effort */ }
}

/** Subscribe a screen to the current preference. Triggers a re-render when
 *  any caller flips the value via `setThemePreference`. */
export function useThemePreference(): ThemePreference {
  const [pref, setPref] = useState<ThemePreference>(cached);
  useEffect(() => {
    void ensureLoaded();
    const fn = (p: ThemePreference): void => setPref(p);
    listeners.add(fn);
    return (): void => { listeners.delete(fn); };
  }, []);
  return pref;
}

/** Resolve the effective color scheme: 'system' delegates to the OS, anything
 *  else wins. Returns 'dark' | 'light' (never null) so callers can do a
 *  simple `=== 'dark'` check. */
export function useEffectiveColorScheme(): 'light' | 'dark' {
  const pref = useThemePreference();
  const sys = useColorScheme();
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return sys === 'dark' ? 'dark' : 'light';
}

/** Scheme-aware palette shared by every screen's inline StyleSheet. Maps 1:1 to
 *  the canonical kit semantic tokens (@metro-labs/kit/tokens, no app-local
 *  forks): `text` body text, `link` emphasis, `primary` primary-button fill,
 *  `inputBg` input/dropdown fill, `toolbarBg` solid nav fill. */
export interface Palette {
  bg: string; border: string; text: string; link: string; primary: string;
  danger: string; success: string; inputBg: string; toolbarBg: string;
}

/** Subscribe a screen to color-override changes so edits on the Kit page
 *  re-theme the whole app live. Returns a monotonically-bumped version that
 *  forces a re-render whenever overrides load/change/reset. */
function useOverridesVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    loadOverrides();
    loadRadius();
    const bump = (): void => setV((n) => n + 1);
    // Radius edits also push into the kit Button default here so every palette
    // consumer (i.e. every screen) repaints its buttons with the new radius.
    const unsubColors = subscribeOverrides(bump);
    const unsubRadius = subscribeRadius(() => { setDefaultButtonRadius(getRadius()); bump(); });
    setDefaultButtonRadius(getRadius());
    return () => { unsubColors(); unsubRadius(); };
  }, []);
  return v;
}

/** The persisted button corner-radius token (px), reactive to load/edit/reset.
 *  Reading it also pushes the value into the kit Button's module-level default
 *  (setDefaultButtonRadius) so EVERY button — even ones not re-rendered by this
 *  hook — picks up the new radius on the next paint. Mount this once high in the
 *  tree (e.g. the root layout) so the wiring is always live. */
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

/** The persisted block corner-radius token (px) for non-button containers —
 *  inputs/text fields, cards, modals/sheets and general bordered/filled blocks.
 *  Reactive to load/edit/reset. Unlike the button radius this is read directly
 *  at each container call site (there's no kit-wide module default to push). */
/** Apply an alpha (0..1) to a palette token, returning an rgba() string. Handles
 *  #rgb / #rrggbb hex and rgb()/rgba() inputs (the forms palette tokens take,
 *  including user overrides). Falls back to the input unchanged if it can't be
 *  parsed, so a malformed override never crashes a render. Used for accent tints
 *  (e.g. the poll result bar / selected-row fill) that must track `link`. */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const rgb = color.trim().match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  return color;
}

export function useBlockRadius(): number {
  const [r, setR] = useState(getBlockRadius());
  useEffect(() => {
    loadRadius();
    setR(getBlockRadius());
    const unsub = subscribeRadius(() => setR(getBlockRadius()));
    return unsub;
  }, []);
  return r;
}

/** Resolve the shared palette for the effective color scheme. Each token is the
 *  user's persisted override (if any, for the active scheme) layered OVER the
 *  canonical kit default — making the whole app re-theme live when the Kit page
 *  edits a token. Reactive to BOTH theme changes and override changes. */
export function usePalette(): Palette {
  const scheme = useEffectiveColorScheme();
  const version = useOverridesVersion(); // re-render on override load/edit/reset
  /** PERF: memoise so the palette object IDENTITY stays stable across unrelated
   *  re-renders (only changes when scheme/override version bumps). usePalette is
   *  consumed by ~60 components; a fresh object every render defeated every
   *  downstream memo that closed over the palette. */
  return useMemo(() => {
    const s = semanticPalette(scheme);
    // Overrides only apply under the Custom theme; Light/Dark/System ignore them.
    const ov = isCustomTheme() ? getOverrides() : {};
    const pick = (key: TokenKey, def: string): string => ov[key]?.[scheme] ?? def;
    return {
      bg: pick('bg', s.bgColor),
      border: pick('border', s.borderColor),
      text: pick('text', s.textColor),
      link: pick('link', s.linkColor),
      primary: pick('primary', s.primaryColor),
      danger: pick('danger', s.dangerColor),
      success: pick('success', s.successColor),
      inputBg: pick('inputBg', s.inputBgColor), toolbarBg: pick('toolbarBg', s.toolbarBgColor),
    };
  }, [scheme, version]);
}

/** ChatKit-shaped theme object for the effective scheme (PR1). Additive helper
 *  alongside usePalette; reactive to theme changes. Defaults reproduce today's
 *  values, so adopting it is non-breaking. */
export function useKitTheme(opts?: KitThemeOptions): KitTheme {
  const scheme = useEffectiveColorScheme();
  return useMemo(() => kitTheme(scheme, opts), [scheme, opts?.radius, opts?.density, opts?.baseSize, opts?.accentLevel]);
}
