import type { AppIconName } from '../appIcons';

type SettingsSectionId = 'profile' | 'appearance' | 'security' | 'devices' | 'wallet' | 'advanced';

interface SettingsSectionInfo {
  href: string;
  icon: AppIconName;
}

const SETTINGS_SECTIONS: Readonly<Record<SettingsSectionId, SettingsSectionInfo>> = {
  profile: { href: '/settings/profile', icon: 'IconPeopleCircle' },
  appearance: { href: '/settings/display', icon: 'IconSun' },
  security: { href: '/settings/security', icon: 'IconKey2' },
  devices: { href: '/settings/devices', icon: 'IconDevices' },
  wallet: { href: '/settings/wallet', icon: 'IconWallet4' },
  advanced: { href: '/settings/advanced', icon: 'IconCode' },
};

export function settingsSection(id: SettingsSectionId): SettingsSectionInfo {
  return SETTINGS_SECTIONS[id];
}
