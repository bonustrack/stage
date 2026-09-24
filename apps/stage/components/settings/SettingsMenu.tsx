import { useRouter } from 'expo-router';


import { SETTINGS_MENU_ITEMS } from './SettingsMenu.model';
import { capabilities } from '../../lib/capabilities';
import { SettingsPage } from './SettingsPage';
import { SettingsList, SettingsNavRow } from './rows';
import { SettingsAccountHeader } from './SettingsAccountHeader';
import { useActiveAccountRecord } from '../../modules/messaging';
import { profileLinkOf } from '../../lib/links';

const PROFILE_SETTINGS_HREF = '/settings/profile';

export function SettingsMenu(): React.ReactElement {
  const router = useRouter();
  const address = useActiveAccountRecord()?.address ?? null;
  const open = (href: string): void => {
    if (href === PROFILE_SETTINGS_HREF && address) router.push(profileLinkOf(address));
    else capabilities.navigate(href);
  };
  return (
    <SettingsPage title="Settings" root>
      <SettingsAccountHeader />
      <SettingsList>
        {SETTINGS_MENU_ITEMS.map((item) => (
          <SettingsNavRow
            key={item.href}
            label={item.label}
            iconStart={item.icon}
            onPress={() => { open(item.href); }}
          />
        ))}
      </SettingsList>
    </SettingsPage>
  );
}
