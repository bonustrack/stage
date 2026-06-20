
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'app.theme';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

export function isThemePreference(v: unknown): v is ThemePreference {
  return typeof v === 'string' && (THEME_PREFERENCES as readonly string[]).includes(v);
}
