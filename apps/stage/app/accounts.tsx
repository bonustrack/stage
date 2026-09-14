
import { Col, ScreenScroll } from '../components/layout';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../lib/safeArea';
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

      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <AccountsManager dark={dark} flat onSwitched={() => { router.back(); }}/>
      </ScreenScroll>
    </Col>
  );
}
