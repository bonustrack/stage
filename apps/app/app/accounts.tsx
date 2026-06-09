/** Accounts page — full-screen account switcher, opened by tapping the topnav
 *  avatar on the Channels tab. Hosts AccountsManager (flat mode) under a native
 *  in-screen header (back arrow + "Accounts" title), matching the search page.
 *  Switching is in-place (epoch bump) so the channels list re-inits without a
 *  full reload; the user taps back to return. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Title } from '@metro-labs/kit/title';
import { Row, Col } from '../components/layout';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { Icon } from '@metro-labs/kit/icon';
import { AccountsManager } from '../components/AccountsManager';

export default function Accounts(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      {/* Topnav: back + title, mirroring the search page. Paints toolbarBg +
          absorbs the top inset so the bar reaches the screen edge. */}
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Title size="sm" color={head}>
          Accounts
        </Title>
      </Row>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <AccountsManager dark={dark} flat onSwitched={() => router.back()}/>
      </ScrollView>
    </Col>
  );
}
