import type { AppIconName } from '../appIcons';

export type SettingsMenuHint = 'theme';

export interface SettingsMenuItem {
  href: string;
  label: string;
  icon: AppIconName;
  hint?: SettingsMenuHint;
}

export interface SettingsMenuSection {
  title: string | null;
  items: SettingsMenuItem[];
}

export const PROFILE_SETTINGS_HREF = '/settings/profile';

export const SETTINGS_MENU_SECTIONS: SettingsMenuSection[] = [
  {
    title: 'Preferences',
    items: [
      { href: '/settings/display', label: 'Display', icon: 'IconSun', hint: 'theme' },
      { href: '/settings/notifications', label: 'Notifications', icon: 'IconBell' },
      { href: '/settings/messenger', label: 'Messenger', icon: 'IconBubble3' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/settings/wallet', label: 'Wallet', icon: 'IconWallet4' },
      { href: '/settings/security', label: 'Security', icon: 'IconKey2' },
    ],
  },
  {
    title: null,
    items: [
      { href: '/settings/about', label: 'About', icon: 'IconQuestionmarkCircle' },
    ],
  },
];

export function menuItemValue(item: SettingsMenuItem, hints: Record<SettingsMenuHint, string>): string | undefined {
  return item.hint === undefined ? undefined : hints[item.hint];
}
