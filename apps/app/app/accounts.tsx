/** Accounts page — full-screen account switcher, opened by tapping the topnav
 *  avatar on the Channels tab. Hosts AccountsManager (flat mode) under a native
 *  in-screen header (back arrow + "Accounts" title), matching the search page.
 *  Switching is in-place (epoch bump) so the channels list re-inits without a
 *  full reload; the user taps back to return. */

import { Pressable, ScrollView } from 'react-native';
import { Title } from '@metro-labs/kit/title';
import { Box } from '../components/layout';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { Icon } from '@metro-labs/kit/icon';
import { AccountsManager } from '../components/AccountsManager';

export default function Accounts(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      {/* Topnav: back + title, mirroring the search page. Paints toolbarBg +
          absorbs the top inset so the bar reaches the screen edge. */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8 + insets.top, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
        backgroundColor: toolbarBg,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title dark={dark} style={{ color: head, fontSize: 20 }}>
          Accounts
        </Title>
      </Box>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <AccountsManager dark={dark} flat onSwitched={() => router.back()} />
      </ScrollView>
    </Box>
  );
}
