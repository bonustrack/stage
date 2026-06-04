/** Kit sub-page of the System menu — back-arrow header + the KitGallery body.
 *  Reached via /system → "Kit" row → /system/kit. */

import { Linking, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { KitGallery } from './KitGallery';
import { GithubLogo } from '../GithubLogo';

const KIT_GITHUB_URL = 'https://github.com/bonustrack/metro/tree/main/packages/kit';

export function KitPage(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader
        title="Kit" dark={dark} fg={fg} head={head} border={border}
        right={
          <Pressable
            onPress={() => Linking.openURL(KIT_GITHUB_URL)}
            hitSlop={8}
            style={{ padding: 4 }}
            accessibilityLabel="View @metro-labs/kit on GitHub"
          >
            <GithubLogo size={22} color={fg} />
          </Pressable>
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        <KitGallery dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
      </ScrollView>
    </Box>
  );
}
