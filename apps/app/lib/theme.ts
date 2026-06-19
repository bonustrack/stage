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
  semanticColors, semanticPalette,
} from '@metro-labs/kit/tokens';
import { setDefaultButtonRadius } from '@metro-labs/kit/button';
import {
  getSeeds, loadOverrides, isCustomTheme,
  subscribe as subscribeOverrides,
} from './colorOverrides';
import { derivePalette } from '@metro-labs/kit/theme-derive';
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

/** Reactive snapshot of the current Custom-theme seeds. Re-renders the caller
 *  whenever any seed/custom flag changes (load/edit/reset). Used by the seed
 *  editor so its controls reflect + drive the live theme. */
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

/** Scheme-independent semantic constants (same hex in dark + light) for the
 *  many sub-components that take a `dark` prop instead of the full palette.
 *  Sourced from the kit tokens — no app-local fork. */
/** Semantic danger color (same hex in dark + light) for `dark`-prop sub-components. */
export const DANGER = semanticColors.dangerColor.dark;
/** Semantic success color (same hex in dark + light) for `dark`-prop sub-components. */
export const SUCCESS = semanticColors.successColor.dark;

/** Cached preference — populated on first hook mount from SecureStore. Subsequent reads
 *  return synchronously so screens never flash the wrong theme. */
let cached: ThemePreference = 'system';
let loaded = false;
const listeners = new Set<(p: ThemePreference) => void>();

/** Emit helper. */
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
    /** Fn helper. */
    const fn = (p: ThemePreference): void => { setPref(p); };
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
  bg: string; border: string; text: string; sub: string; link: string;
  primary: string; danger: string; success: string;
  inputBg: string; toolbarBg: string;
}

/** Subscribe a screen to color-override changes so edits on the Kit page
 *  re-theme the whole app live. Returns a monotonically-bumped version that
 *  forces a re-render whenever overrides load/change/reset. */
function useOverridesVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    loadOverrides();
    loadRadius();
    /** Bump helper. */
    const bump = (): void => { setV((n) => n + 1); };
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

/** Reactive hook returning the current message-block corner radius, re-rendering on changes. */
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
    // The Custom theme DERIVES the whole palette from the user's seed (grayscale
    // base + accent + surface bg/fg) via the kit `derivePalette`. The default
    // seed reproduces the canonical kit palette pixel-for-pixel, so the non-
    // custom path (plain Light/Dark/System) stays on `semanticPalette`.
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
