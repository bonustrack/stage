/** App-wide theme switcher for the System screen. The app already has a real
 *  theme-preference store (lib/theme.ts: setThemePreference + a module-level
 *  pub/sub that every usePalette/useEffectiveColorScheme consumer subscribes to),
 *  so flipping a value here re-themes the WHOLE app instantly — no new store
 *  needed. Renders System / Light / Dark as a segmented pill, reusing the same
 *  option data as the Settings screen. */

import { Box, Row } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Title } from '@metro-labs/kit/title';
import { Button } from '@metro-labs/kit/button';
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
          // Primary (active) text is bg-contrasting (dark scheme → dark text);
          // secondary (inactive) uses the head token. Mirror that for the icon.
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
