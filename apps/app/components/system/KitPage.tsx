/** Kit sub-page of Settings - back-arrow header + theme switcher, then the kit
 *  primitives rendered directly (KitSections) and the live color/radius editor
 *  (ColorTokens). Reached via /settings -> "Kit" row -> /settings/kit. */

import { Linking, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { ThemeSwitcher } from './ThemeSwitcher';
import { KitSections } from './KitSections';
import { ColorTokens } from './ColorTokens';
import { Title } from '@metro-labs/kit/title';
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
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
      >
        <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
        <KitSections dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
        <Box style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Title dark={dark} level={3} color={head}>Colors</Title>
          <ColorTokens p={{ dark, head, sub, border, rowBg }} />
        </Box>
      </ScrollView>
    </Box>
  );
}
