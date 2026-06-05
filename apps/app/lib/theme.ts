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
import { semanticColors, semanticPalette } from '@metro-labs/kit/tokens';
import { setDefaultButtonRadius } from '@metro-labs/kit/button';
import {
  getOverrides, loadOverrides, subscribe as subscribeOverrides,
  type TokenKey,
} from './colorOverrides';
import {
  getRadius, getBlockRadius, loadRadius,
  subscribe as subscribeRadius,
} from './radiusOverride';

export { setRadius, setBlockRadius, resetRadius } from './radiusOverride';

export type { ThemePreference };

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

/** The 5-key scheme-aware palette shared by every screen's inline StyleSheet.
 *  Maps 1:1 to the canonical kit semantic tokens (single source of truth:
 *  @metro-labs/kit/tokens) — no app-local color forks. `text` = body text,
 *  `link` = emphasis (titles/names/active icons/accents — brand teal),
 *  `primary` = primary-button background fill ONLY (white/black). */
export interface Palette {
  bg: string; border: string; text: string; link: string; primary: string;
  danger: string; success: string;
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
  /** PERF: memoise the palette object so its IDENTITY is stable across unrelated
   *  parent re-renders (it only changes when the scheme or an override version
   *  bumps). usePalette is consumed by ~60 components; returning a fresh object
   *  every render defeated every downstream useMemo/useCallback/React.memo that
   *  closed over the palette, cascading re-renders on every stream tick and tap.
   *  Now a stream tick that doesn't touch theme leaves the object referentially
   *  identical, so memoised children/derivations are skipped. */
  return useMemo(() => {
    const s = semanticPalette(scheme);
    const ov = getOverrides();
    const pick = (key: TokenKey, def: string): string => ov[key]?.[scheme] ?? def;
    return {
      bg: pick('bg', s.bgColor),
      border: pick('border', s.borderColor),
      text: pick('text', s.textColor),
      link: pick('link', s.linkColor),
      primary: pick('primary', s.primaryColor),
      danger: pick('danger', s.dangerColor),
      success: pick('success', s.successColor),
    };
  }, [scheme, version]);
}
