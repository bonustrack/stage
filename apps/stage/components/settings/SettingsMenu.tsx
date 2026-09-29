import { useRouter } from 'expo-router';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { SETTINGS_GROUPS, settingsSection, type SettingsSectionInfo } from './settingsCatalog.model';
import { capabilities } from '../../lib/capabilities';
import { SettingsGroup, SettingsPage } from './SettingsPage';
import { SettingsNavRow } from './rows';
import { SettingsAccountHeader } from './SettingsAccountHeader';
import { SettingsAboutFooter } from './SettingsAboutFooter';
import { useActiveAccountRecord } from '../../modules/messaging';
import { profileLinkOf } from '../../lib/links';

export function SettingsMenu({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const address = useActiveAccountRecord()?.address ?? null;
  const open = (section: SettingsSectionInfo): void => {
    if (section.id === 'profile' && address) router.push(profileLinkOf(address));
    else capabilities.navigate(section.href);
  };
  const row = (section: SettingsSectionInfo): React.ReactElement => (
    <SettingsNavRow key={section.id} label={section.label} iconStart={section.icon} onPress={() => { open(section); }} />
  );
  return (
    <SettingsPage title="Settings" root panRef={panRef}>
      <SettingsAccountHeader />
      <SettingsGroup>{row(settingsSection('profile'))}</SettingsGroup>
      {SETTINGS_GROUPS.map((ids) => (
        <SettingsGroup key={ids.join()}>{ids.map((id) => row(settingsSection(id)))}</SettingsGroup>
      ))}
      <SettingsAboutFooter />
    </SettingsPage>
  );
}
