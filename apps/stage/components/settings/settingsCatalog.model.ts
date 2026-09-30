import type { AppIconName } from '../appIcons';

export type SettingsSectionId = 'profile' | 'appearance' | 'notifications' | 'security' | 'devices' | 'wallet' | 'advanced';

export interface SettingsSectionInfo {
  id: SettingsSectionId;
  href: string;
  label: string;
  description: string;
  icon: AppIconName;
  keywords: readonly string[];
}

export const SETTINGS_SECTIONS: readonly SettingsSectionInfo[] = [
  {
    id: 'profile', href: '/settings/profile', label: 'Profile', description: 'Name, username and picture',
    icon: 'IconPeopleCircle', keywords: ['name', 'username', 'picture', 'avatar', 'photo', 'handle', 'basename'],
  },
  {
    id: 'appearance', href: '/settings/display', label: 'Appearance', description: 'Theme and colors',
    icon: 'IconSun', keywords: ['theme', 'dark', 'light', 'system', 'colors', 'custom', 'display'],
  },
  {
    id: 'notifications', href: '/settings/notifications', label: 'Notifications', description: 'Push notifications',
    icon: 'IconBell', keywords: ['push', 'alerts', 'permission'],
  },
  {
    id: 'security', href: '/settings/security', label: 'Security', description: 'Recovery phrase and private key',
    icon: 'IconKey2', keywords: ['recovery phrase', 'backup', 'private key', 'export', 'seed', 'words'],
  },
  {
    id: 'devices', href: '/settings/devices', label: 'Devices', description: 'Sessions, linking and chat history',
    icon: 'IconDevices', keywords: ['sessions', 'installations', 'revoke', 'link', 'qr', 'history', 'sync', 'transfer', 'import'],
  },
  {
    id: 'wallet', href: '/settings/wallet', label: 'Wallet', description: 'Address and network',
    icon: 'IconWallet4', keywords: ['address', 'smart account', 'kernel', 'network', 'base', 'signer', 'deploy'],
  },
  {
    id: 'advanced', href: '/settings/advanced', label: 'Advanced', description: 'XMTP identity and reset',
    icon: 'IconCode', keywords: ['xmtp', 'inbox id', 'installation id', 'reset', 'database', 'remove account', 'delete'],
  },
];

export function settingsSection(id: SettingsSectionId): SettingsSectionInfo {
  const found = SETTINGS_SECTIONS.find((s) => s.id === id);
  if (found === undefined) throw new Error(`Unknown settings section ${id}`);
  return found;
}
