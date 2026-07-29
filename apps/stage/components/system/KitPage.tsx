
import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { StackHeader } from '../chrome/StackHeader';
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
      <StackHeader
        title="Kit"
        trailing={
          <Col flex={1} align="end">
            <Pressable
              onPress={() => { void Linking.openURL(KIT_GITHUB_URL); }}
              hitSlop={8}
              style={{ padding: 4 }}
              accessibilityLabel="View @stage-labs/kit on GitHub"
>
              <GithubLogo size={22} color={fg}/>
            </Pressable>
          </Col>
        }
/>
      <ScrollView
        style={[{ flex: 1 }, WEB_STACK_SCROLL]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ flexGrow: 1, paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}
>
        <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}/>
        <KitSections dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}/>
      </ScrollView>
    </Col>
  );
}
