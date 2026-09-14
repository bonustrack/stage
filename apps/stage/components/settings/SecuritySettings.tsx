
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col, ScreenScroll } from '../layout';
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
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <SecureWalletNudge/>
        <AccountSecuritySection
          c={{ fg, head, sub, border, rowBg }}
          danger={DANGER}
          dark={dark}
/>
      </ScreenScroll>
    </Col>
  );
}
