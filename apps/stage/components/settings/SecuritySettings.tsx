import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SecureWalletNudge } from '../onboarding/SecureWalletNudge';
import { SettingsPage } from './SettingsPage';

export function SecuritySettings(): React.ReactElement {
  return (
    <SettingsPage title="Security">
      <SecureWalletNudge/>
      <AccountSecuritySection/>
    </SettingsPage>
  );
}
