import type { AppIconName } from '../appIcons';

export interface SettingsMenuItem {
  href: string;
  label: string;
  icon: AppIconName;
}

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  { href: '/settings/profile', label: 'Profile', icon: 'IconPeopleCircle' },
  { href: '/settings/display', label: 'Display', icon: 'IconSun' },
  { href: '/settings/messenger', label: 'Messenger', icon: 'IconBubble3' },
  { href: '/settings/notifications', label: 'Notifications', icon: 'IconBell' },
  { href: '/settings/wallet', label: 'Wallet', icon: 'IconWallet4' },
  { href: '/settings/security', label: 'Security', icon: 'IconKey2' },
  { href: '/settings/about', label: 'About', icon: 'IconQuestionmarkCircle' },
];
