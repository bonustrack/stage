/** Settings → Display - switch the app theme between System / Light / Dark, or
 *  pick Custom to edit the palette color + radius tokens inline.
 *  Reuses the existing theme store (lib/theme: setThemePreference +
 *  useThemePreference, a module-level pub/sub that re-themes the whole app
 *  instantly) and the shared THEME_OPTIONS data. Custom is an orthogonal flag
 *  (useCustomTheme/setCustomTheme): when on, the saved color overrides apply
 *  and the ColorTokens editor (moved here from the Kit page) is revealed. No
 *  new store. */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { Card } from '@metro-labs/kit/card';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useEffectiveColorScheme, usePalette, useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from '../tabs/SettingsScreen.parts';
import { SystemHeader } from '../system/SystemHeader';
import { ColorTokens } from '../system/ColorTokens';

export function DisplaySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const custom = useCustomTheme();
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <SystemHeader title="Display" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        <Text size="sm" style={{ color: sub, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          THEME
        </Text>
        <Box mx={16} style={{ overflow: 'hidden' }}>
          <Card dark={dark} background={rowBg} padding={0}>
            <ListView dark={dark}>
              {THEME_OPTIONS.map((opt) => {
                const selected = !custom && pref === opt.value;
                return (
                  <ListViewItem
                    key={opt.value}
                    dark={dark}
                    onPress={() => { setCustomTheme(false); void setThemePreference(opt.value); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                  >
                    <Icon name={opt.icon} size={22} color={head} />
                    <Text size="lg" style={{ color: fg, flex: 1 }}>{opt.label}</Text>
                    {selected ? <Icon name="check" size={20} color={head} /> : null}
                  </ListViewItem>
                );
              })}
              <ListViewItem
                key="custom"
                dark={dark}
                onPress={() => setCustomTheme(true)}
                style={{ paddingHorizontal: 14, paddingVertical: 14 }}
              >
                <Icon name="colorSwatch" size={22} color={head} />
                <Text size="lg" style={{ color: fg, flex: 1 }}>Custom</Text>
                {custom ? <Icon name="check" size={20} color={head} /> : null}
              </ListViewItem>
            </ListView>
          </Card>
        </Box>

        {custom ? (
          <Box style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text size="sm" style={{ color: sub, paddingBottom: 4 }}>
              CUSTOM COLORS
            </Text>
            <ColorTokens p={{ dark, head, sub, border, rowBg }} />
          </Box>
        ) : null}
      </ScrollView>
    </Box>
  );
}
