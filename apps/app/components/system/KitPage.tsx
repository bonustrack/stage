/** Kit sub-page of Settings - back-arrow header + theme switcher, then the kit
 *  primitives rendered directly (KitSections). Reached via /settings -> "Kit"
 *  row -> /settings/kit. The live color/radius editor moved to Settings ->
 *  Display under the Custom theme. */

import { Linking } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';
import { ThemeSwitcher } from './ThemeSwitcher';
import { KitSections } from './KitSections';
import { GithubLogo } from '../GithubLogo';

const KIT_GITHUB_URL = 'https://github.com/bonustrack/stage/tree/main/packages/kit';

export function KitPage(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader
        title="Kit" dark={dark} fg={fg} head={head} border={border}
        right={
          <Pressable
            onPress={() => Linking.openURL(KIT_GITHUB_URL)}
            hitSlop={8}
            style={{ padding: 4 }}
            accessibilityLabel="View @metro-labs/kit on GitHub"
>
            <GithubLogo size={22} color={fg}/>
          </Pressable>
        }
/>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
>
        <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}/>
        <KitSections dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}/>
      </ScrollView>
    </Col>
  );
}
