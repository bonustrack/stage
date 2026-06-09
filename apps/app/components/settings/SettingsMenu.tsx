/** Settings menu - a System-page-style list whose rows push their own
 *  sub-pages: Display (theme), Messenger (XMTP account + settings), Security
 *  (export / remove account). Reached from the LeftDrawer's "Settings" row. */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';

type Href =
  | '/settings/display'
  | '/settings/messenger'
  | '/settings/notifications'
  | '/settings/security'
  | '/settings/experimental'
  | '/settings/about';
const ROWS: { href: Href; label: string; icon: HeroIconName }[] = [
  { href: '/settings/display', label: 'Display', icon: 'sun' },
  { href: '/settings/messenger', label: 'Messenger', icon: 'chat' },
  { href: '/settings/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/settings/security', label: 'Security', icon: 'wallet' },
  { href: '/settings/experimental', label: 'Experimental', icon: 'beaker' },
  { href: '/settings/about', label: 'About', icon: 'questionMarkCircle' },
];

export function SettingsMenu(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();

  return (
    <Col background={bg} flex={1}>
      <SystemHeader title="Settings" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ListView dark={dark}>
          {ROWS.map((row) => (
            <ListViewItem key={row.href} dark={dark} onPress={() => router.push(row.href)}>
              <Icon name={row.icon} size={22} color={head}/>
              <Col flex={1}>
                <Text size="xl" color={head}>{row.label}</Text>
              </Col>
              <Icon name="chevronRight" size={18} color={sub}/>
            </ListViewItem>
          ))}
        </ListView>
      </ScrollView>
    </Col>
  );
}
