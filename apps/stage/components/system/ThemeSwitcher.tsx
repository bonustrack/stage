
import { Box, Row } from '../layout';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Title } from '@stage-labs/kit/react-native/title';
import { Button } from '@stage-labs/kit/react-native/button';
import { setThemePreference, useThemePreference } from '../../lib/theme';
import { THEME_OPTIONS } from '../tabs/SettingsScreen.parts';

export function ThemeSwitcher({ dark, head }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
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
              variant={active ? 'primary' : 'secondary'}
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
