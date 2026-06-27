
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { basicRoot, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import { Col } from '../components/layout';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { AccountsManager } from '../components/AccountsManager';

export default function Accounts(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();
  const headerNode = basicRoot(screenHeader({
    title: 'Accounts',
    titleStyle: { kind: 'title', size: 'sm', color: head },
    backColor: fg,
    safeTop: insets.top,
    surface: toolbarBg,
    borderColor: border,
  }));
  const headerRegistry: WidgetActionRegistry = {
    [SCREEN_BACK]: () => { router.back(); },
  };

  return (
    <Col surface="surface" flex={1}>
      {}
      <KitRenderer node={headerNode} registry={headerRegistry} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <AccountsManager dark={dark} flat onSwitched={() => { router.back(); }}/>
      </ScrollView>
    </Col>
  );
}
