/** Theme-preference primitives shared by both shells. The *storage* and
 *  *reactivity* are framework-specific (apps/ui uses a Vue ref + localStorage;
 *  apps/app uses a React hook + expo-secure-store), so only the type, the
 *  valid-value set, and the storage key live here — the single contract both
 *  implementations agree on. */

export type ThemePreference = 'light' | 'dark' | 'system';

/** Storage key both shells persist the preference under. */
export const THEME_STORAGE_KEY = 'app.theme';

/** Allowed values — used to validate persisted/incoming strings. */
export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

export function isThemePreference(v: unknown): v is ThemePreference {
  return typeof v === 'string' && (THEME_PREFERENCES as readonly string[]).includes(v);
}
