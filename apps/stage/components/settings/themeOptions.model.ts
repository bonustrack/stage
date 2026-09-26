import type { AppIconName } from '../appIcons';
import type { ThemePreference } from '../../lib/theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: AppIconName }[] = [
  { value: 'system', label: 'System', icon: 'IconImac' },
  { value: 'light', label: 'Light', icon: 'IconSun' },
  { value: 'dark', label: 'Dark', icon: 'IconMoon' },
];

export function themeLabel(pref: ThemePreference, custom: boolean): string {
  if (custom) return 'Custom';
  return THEME_OPTIONS.find((opt) => opt.value === pref)?.label ?? 'System';
}
