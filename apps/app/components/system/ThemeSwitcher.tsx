/** App-wide theme switcher for the System screen. The app already has a real
 *  theme-preference store (lib/theme.ts: setThemePreference + a module-level
 *  pub/sub that every usePalette/useEffectiveColorScheme consumer subscribes to),
 *  so flipping a value here re-themes the WHOLE app instantly — no new store
 *  needed. Renders System / Light / Dark as a segmented pill, reusing the same
 *  option data as the Settings screen. */

import { Pressable } from 'react-native';
import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Title } from '@metro-labs/kit/title';
import { setThemePreference, useThemePreference } from '../../lib/theme';
import { THEME_OPTIONS } from '../tabs/SettingsScreen.parts';

export function ThemeSwitcher({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  const pref = useThemePreference();
  return (
    <Box style={{ paddingHorizontal: 16, paddingTop: 18 }}>
      <Title dark={dark} level={3} color={head}>Theme</Title>
      <Row gap={8} mt={10}>
        {THEME_OPTIONS.map((opt) => {
          const active = pref === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => { void setThemePreference(opt.value); }}
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 11,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderWidth: 1,
                borderColor: active ? head : border,
                backgroundColor: active ? rowBg : 'transparent',
              }}
            >
              <Icon name={opt.icon} size={20} color={active ? head : sub} />
              <Text style={{ color: active ? head : sub, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </Row>
    </Box>
  );
}
