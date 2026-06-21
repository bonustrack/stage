
import { type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { type ThemePreference } from '../../lib/theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light',  label: 'Light',  icon: 'sun' },
  { value: 'dark',   label: 'Dark',   icon: 'moon' },
];
