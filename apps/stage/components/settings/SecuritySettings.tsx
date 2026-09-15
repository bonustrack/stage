import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col, ScreenScroll } from '../layout';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SecureWalletNudge } from '../onboarding/SecureWalletNudge';
import { StackHeader } from '../chrome/StackHeader';

export function SecuritySettings(): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Security"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <SecureWalletNudge/>
        <AccountSecuritySection/>
      </ScreenScroll>
    </Col>
  );
}
