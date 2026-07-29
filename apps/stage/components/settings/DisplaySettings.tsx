
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useEffectiveColorScheme, usePalette, useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from '../tabs/SettingsScreen.parts';
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
      <ScrollView
        style={[{ flex: 1 }, WEB_STACK_SCROLL]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ flexGrow: 1, paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}
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
      </ScrollView>
    </Col>
  );
}
