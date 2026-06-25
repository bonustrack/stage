
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type {
  ListViewItemNode,
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/chatkit';
import {
  col,
  icon,
  text,
  SETTINGS_THEME_SELECT,
} from '@stage-labs/views';
import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useEffectiveColorScheme, usePalette, useThemePreference,
  type ThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from '../tabs/SettingsScreen.parts';
import { SystemHeader } from '../system/SystemHeader';
import { ColorTokens } from '../system/ColorTokens';

type ThemeValue = ThemePreference | 'custom';

function themeRow(
  value: ThemeValue,
  label: string,
  iconName: string,
  selected: boolean,
): ListViewItemNode {
  const trailing = selected ? [icon('check', { color: 'link', size: 'lg' })] : [];
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    onClickAction: { type: SETTINGS_THEME_SELECT, payload: { value } },
    children: [
      icon(iconName, { color: 'link', size: 'xl' }),
      col([text(label, { size: 'xl', color: 'text', truncate: true })], { flex: 1 }),
      ...trailing,
    ],
  };
}

export function DisplaySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const custom = useCustomTheme();
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  const node: ListViewNode = {
    type: 'ListView',
    children: [
      ...THEME_OPTIONS.map((opt) =>
        themeRow(opt.value, opt.label, opt.icon, !custom && pref === opt.value),
      ),
      themeRow('custom', 'Custom', 'colorSwatch', custom),
    ],
  };

  const registry: WidgetActionRegistry = {
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
      <SystemHeader title="Display" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          THEME
        </Text>
        <ChatKitRenderer node={node} registry={registry}/>

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
