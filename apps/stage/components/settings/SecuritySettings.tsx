import { SecuritySection } from './SecuritySection';
import { SettingsPage } from './SettingsPage';

export function SecuritySettings(): React.ReactElement {
  return (
    <SettingsPage title="Security">
      <SecuritySection/>
    </SettingsPage>
  );
}
