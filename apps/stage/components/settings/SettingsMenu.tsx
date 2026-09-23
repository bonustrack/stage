

import { SETTINGS_MENU_ITEMS } from './SettingsMenu.model';
import { capabilities } from '../../lib/capabilities';
import { SettingsPage } from './SettingsPage';
import { SettingsList, SettingsNavRow } from './rows';
import { SettingsAccountHeader } from './SettingsAccountHeader';

export function SettingsMenu(): React.ReactElement {
  return (
    <SettingsPage title="Settings" root>
      <SettingsAccountHeader />
      <SettingsList>
        {SETTINGS_MENU_ITEMS.map((item) => (
          <SettingsNavRow
            key={item.href}
            label={item.label}
            iconStart={item.icon}
            onPress={() => { capabilities.navigate(item.href); }}
          />
        ))}
      </SettingsList>
    </SettingsPage>
  );
}
