/** Accounts page — full-screen account switcher, opened by tapping the topnav
 *  avatar on the Channels tab. Hosts AccountsManager (flat mode) under a native
 *  in-screen header (back arrow + "Accounts" title), matching the search page.
 *  Switching is in-place (epoch bump) so the channels list re-inits without a
 *  full reload; the user taps back to return. */

import { Pressable, ScrollView, Text } from 'react-native';
import { Box } from '../components/layout';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { HeroIcon } from '../components/HeroIcon';
import { AccountsManager } from '../components/AccountsManager';

export default function Accounts(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, bg, border } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {/* Topnav: back + title, mirroring the search page. */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold' }}>
          Accounts
        </Text>
      </Box>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <AccountsManager dark={dark} flat onSwitched={() => router.back()} />
      </ScrollView>
    </Box>
  );
}
