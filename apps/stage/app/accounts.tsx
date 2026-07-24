
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../components/layout';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme } from '../lib/theme';
import { StackHeader } from '../components/chrome/StackHeader';
import { AccountsManager } from '../components/AccountsManager';

export default function Accounts(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Accounts" />

      <ScrollView keyboardShouldPersistTaps="handled" style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 24 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}>
        <AccountsManager dark={dark} flat onSwitched={() => { router.back(); }}/>
      </ScrollView>
    </Col>
  );
}
