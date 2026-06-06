/** Settings → Display - switch the app theme between System / Light / Dark.
 *  Reuses the existing theme store (lib/theme: setThemePreference +
 *  useThemePreference, a module-level pub/sub that re-themes the whole app
 *  instantly) and the shared THEME_OPTIONS data. No new store. */

import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { Card } from '@metro-labs/kit/card';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import {
  setThemePreference, useEffectiveColorScheme, usePalette, useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from '../tabs/SettingsScreen.parts';
import { SystemHeader } from '../system/SystemHeader';

export function DisplaySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Display" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, fontFamily: 'Calibre-Medium' }}>
          THEME
        </Text>
        <Box mx={16} style={{ overflow: 'hidden' }}>
          <Card dark={dark} background={rowBg} padding={0}>
            <ListView dark={dark}>
              {THEME_OPTIONS.map((opt) => {
                const selected = pref === opt.value;
                return (
                  <ListViewItem
                    key={opt.value}
                    dark={dark}
                    onPress={() => { void setThemePreference(opt.value); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                  >
                    <Icon name={opt.icon} size={22} color={head} />
                    <Text style={{ color: fg, fontSize: 18, fontFamily: 'Calibre-Medium', flex: 1 }}>{opt.label}</Text>
                    {selected ? <Icon name="check" size={20} color={head} /> : null}
                  </ListViewItem>
                );
              })}
            </ListView>
          </Card>
        </Box>
      </ScrollView>
    </Box>
  );
}
