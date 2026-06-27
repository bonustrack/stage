
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type {
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/kit';
import {
  settingsHeader,
  settingsThemeRow,
  SCREEN_BACK,
  SETTINGS_THEME_SELECT,
} from '@stage-labs/views';
import { useRouter } from 'expo-router';
import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useEffectiveColorScheme, usePalette, useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from '../tabs/SettingsScreen.parts';
import { ColorTokens } from '../system/ColorTokens';

export function DisplaySettings(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const custom = useCustomTheme();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  const node: ListViewNode = {
    type: 'ListView',
    children: [
      ...THEME_OPTIONS.map((opt) =>
        settingsThemeRow({
          value: opt.value,
          label: opt.label,
          iconName: opt.icon,
          selected: !custom && pref === opt.value,
        }),
      ),
      settingsThemeRow({
        value: 'custom',
        label: 'Custom',
        iconName: 'colorSwatch',
        selected: custom,
      }),
    ],
  };

  const headerNode = settingsHeader({
    title: 'Display',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });

  const registry: WidgetActionRegistry = {
    [SCREEN_BACK]: () => { router.back(); },
    [SETTINGS_THEME_SELECT]: (action) => {
      const value = action.payload.value;
      if (value === 'custom') { setCustomTheme(true); return; }
      if (value === 'system' || value === 'light' || value === 'dark') {
        setCustomTheme(false);
        void setThemePreference(value);
      }
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <KitRenderer node={headerNode} registry={registry}/>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          THEME
        </Text>
        <KitRenderer node={node} registry={registry}/>

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
