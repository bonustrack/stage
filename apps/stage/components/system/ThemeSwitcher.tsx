
import { Box, Row } from '../layout';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { Title } from '@stage-labs/kit/react-native/title';
import { Button } from '@stage-labs/kit/react-native/button';
import { setThemePreference, useThemePreference, type ThemePreference } from '../../lib/theme';
import type { GalleryPalette } from './galleryPalette';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light',  label: 'Light',  icon: 'sun' },
  { value: 'dark',   label: 'Dark',   icon: 'moon' },
];

export function ThemeSwitcher({ dark, head }: GalleryPalette): React.ReactElement {
  const pref = useThemePreference();
  return (
    <Box padding={{ x: 16, top: 18 }}>
      <Title level={3} color={head}>Theme</Title>
      <Row margin={{ top: 10 }} gap={8}>
        {THEME_OPTIONS.map((opt) => {
          const active = pref === opt.value;
          const fg = active ? (dark ? '#000000' : '#ffffff') : head;
          return (
            <Button
              key={opt.value}
              dark={dark}
              color={active ? 'primary' : 'secondary'} variant="solid"
              onPress={() => { void setThemePreference(opt.value); }}
              style={{ flex: 1 }}
              icon={<Icon name={opt.icon} size={20} color={fg} />}
              label={opt.label}
            />
          );
        })}
      </Row>
    </Box>
  );
}
