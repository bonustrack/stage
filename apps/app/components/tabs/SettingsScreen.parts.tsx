/** Pieces of the Settings tab split out to keep SettingsScreen.tsx under the
 *  line cap: the theme-option list data. */

import { type HeroIconName } from '@metro-labs/kit/icon';
import { type ThemePreference } from '../../lib/theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light',  label: 'Light',  icon: 'sun' },
  { value: 'dark',   label: 'Dark',   icon: 'moon' },
];
