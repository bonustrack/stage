/** App-wide theme preference: 'light' | 'dark' | 'system'.
 *  Persisted in expo-secure-store under `app.theme`. A tiny module-level
 *  pub/sub keeps every mounted screen in sync the moment the user toggles
 *  the choice on the Settings screen — without spinning up a full context
 *  provider just for one string. */

import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@metro-labs/kit/theme';
import { colors, semanticPalette } from '@metro-labs/kit/tokens';

export type { ThemePreference };

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

/** The 6-key scheme-aware palette shared by every screen's inline StyleSheet.
 *  Single source of truth so the dark/light hex block isn't copy-pasted per file. */
export interface Palette {
  fg: string; head: string; sub: string; bg: string; border: string; rowBg: string;
  /** Canonical semantic tokens (single source of truth: @metro-labs/kit/tokens).
   *  `text` = body text (alias of `fg`); `link`/`primary` are the brand teal. */
  text: string; link: string; primary: string;
}

/** Resolve the shared palette for the effective color scheme. Hex values are
 *  sourced from the kit tokens so the dark/light block is no longer duplicated. */
export function usePalette(): Palette {
  const scheme = useEffectiveColorScheme();
  const dark = scheme === 'dark';
  const s = semanticPalette(scheme);
  return {
    fg: dark ? colors['fg-dark'] : colors['fg-light'],
    head: dark ? colors['head-dark'] : colors['head-light'],
    sub: dark ? colors['sub-dark'] : colors['sub-light'],
    bg: s.bgColor,
    border: s.borderColor,
    rowBg: dark ? colors['surface-dark'] : colors['surface-light'],
    text: s.textColor,
    link: s.linkColor,
    primary: s.primaryColor,
  };
}
