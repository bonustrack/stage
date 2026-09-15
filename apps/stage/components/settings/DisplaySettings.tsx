

import { useSafeAreaInsets } from '../../lib/safeArea';
import { Box, Col, ScreenScroll } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useEffectiveColorScheme, usePalette, useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from '../system/ThemeSwitcher';
import { ColorTokens } from '../system/ColorTokens';
import { StackHeader } from '../chrome/StackHeader';
import { SettingsList, SettingsThemeRow } from './rows';

export function DisplaySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const custom = useCustomTheme();
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Display"/>
      <ScreenScroll
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          THEME
        </Text>
        <SettingsList>
          {THEME_OPTIONS.map((opt) => (
            <SettingsThemeRow
              key={opt.value}
              label={opt.label}
              iconName={opt.icon}
              selected={!custom && pref === opt.value}
              onPress={() => {
                setCustomTheme(false);
                void setThemePreference(opt.value);
              }}
            />
          ))}
          <SettingsThemeRow
            label="Custom"
            iconName="colorSwatch"
            selected={custom}
            onPress={() => { setCustomTheme(true); }}
          />
        </SettingsList>

        {custom ? (
          <Box padding={{ x: 16, top: 24 }}>
            <Text size="xs" role="secondary" style={{ paddingBottom: 4 }}>
              CUSTOM COLORS
            </Text>
            <ColorTokens p={{ dark, head, sub, border, rowBg }}/>
          </Box>
        ) : null}
      </ScreenScroll>
    </Col>
  );
}
