import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SettingsPage } from './SettingsPage';

export function SecuritySettings(): React.ReactElement {
  return (
    <SettingsPage title="Security">
      <AccountSecuritySection/>
    </SettingsPage>
  );
}
