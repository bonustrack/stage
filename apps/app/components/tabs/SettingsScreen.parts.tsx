/**
 * @file Theme-option list data (THEME_OPTIONS) split out of SettingsScreen.tsx to keep it under the line cap.
 */

import { type HeroIconName } from '@metro-labs/kit/icon';
import { type ThemePreference } from '../../lib/theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light',  label: 'Light',  icon: 'sun' },
  { value: 'dark',   label: 'Dark',   icon: 'moon' },
];
