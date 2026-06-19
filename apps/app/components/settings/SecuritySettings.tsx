/**
 * @file Settings -> Security screen: Export private key and Remove account for
 *  the active account, wrapping the existing AccountSecuritySection plus the
 *  wallet-backup nudge.
 */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SystemHeader } from '../system/SystemHeader';
import { SecureWalletNudge } from '../onboarding/SecureWalletNudge';

/** Renders the security settings screen including the wallet backup nudge. */
export function SecuritySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Security" dark={dark} fg={fg} head={head} border={border}/>
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
