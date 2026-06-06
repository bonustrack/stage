/** Settings menu - a System-page-style list whose rows push their own
 *  sub-pages: Display (theme), Messenger (XMTP account + settings), Security
 *  (export / remove account). Reached from the LeftDrawer's "Settings" row. */

import { Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';

type Href =
  | '/settings/display'
  | '/settings/messenger'
  | '/settings/notifications'
  | '/settings/security'
  | '/settings/kit'
  | '/settings/components'
  | '/settings/developer'
  | '/settings/about';
const ROWS: { href: Href; label: string; sub: string; icon: HeroIconName }[] = [
  { href: '/settings/display', label: 'Display', sub: 'Theme - System, Light or Dark', icon: 'sun' },
  { href: '/settings/messenger', label: 'Messenger', sub: 'XMTP account & inbox', icon: 'chat' },
  { href: '/settings/notifications', label: 'Notifications', sub: 'Enable or disable push notifications', icon: 'bell' },
  { href: '/settings/security', label: 'Security', sub: 'Export or remove account', icon: 'wallet' },
  { href: '/settings/kit', label: 'Kit', sub: 'Theme colors & component gallery', icon: 'colorSwatch' },
  { href: '/settings/components', label: 'Components', sub: 'App UI components - UserCard, ChannelCard, TokenCard', icon: 'viewGrid' },
  { href: '/settings/developer', label: 'Developer', sub: 'Railgun debug console & diagnostics', icon: 'beaker' },
  { href: '/settings/about', label: 'About', sub: 'App version & build metadata', icon: 'questionMarkCircle' },
];

export function SettingsMenu(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const divider = border; // #282a2d / #e4e4e5

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Settings" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        {ROWS.map((row) => (
          <Pressable
            key={row.href}
            onPress={() => router.push(row.href)}
            style={({ pressed }) => ({ backgroundColor: pressed ? divider : 'transparent' })}
          >
            <Box
              style={{
                marginHorizontal: 16, paddingVertical: 16,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderBottomWidth: 1, borderBottomColor: divider,
              }}
            >
              <Icon name={row.icon} size={22} color={head} />
              <Box style={{ flex: 1 }}>
                <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Medium' }}>{row.label}</Text>
                <Text style={{ color: sub, fontSize: 13, marginTop: 1, fontFamily: 'Calibre-Medium' }}>{row.sub}</Text>
              </Box>
              <Icon name="chevronRight" size={18} color={sub} />
            </Box>
          </Pressable>
        ))}
      </ScrollView>
    </Box>
  );
}
