
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SecureWalletNudge } from '../onboarding/SecureWalletNudge';
import { SettingsHeader } from './SettingsHeader';

export function SecuritySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Security"/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
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
