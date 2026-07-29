
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SecureWalletNudge } from '../onboarding/SecureWalletNudge';
import { StackHeader } from '../chrome/StackHeader';

export function SecuritySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Security"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}>
        <SecureWalletNudge/>
        <AccountSecuritySection
          c={{ fg, head, sub, border, rowBg }}
          danger={DANGER}
          dark={dark}
/>
      </ScrollView>
    </Col>
  );
}
