/**
 * @file Shared theme-preference contract — the type, valid-value set, and storage key both shells agree on, leaving framework-specific storage and reactivity to each app.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

/** Storage key both shells persist the preference under. */
export const THEME_STORAGE_KEY = 'app.theme';

/** Allowed values — used to validate persisted/incoming strings. */
export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Type guard that narrows an unknown value to a valid ThemePreference. */
export function isThemePreference(v: unknown): v is ThemePreference {
  return typeof v === 'string' && (THEME_PREFERENCES as readonly string[]).includes(v);
}
