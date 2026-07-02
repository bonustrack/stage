import type { ListViewNode } from '@stage-labs/kit/kit';
import { SETTINGS_NAV_PRESS } from '../actions';
import { settingsNavRow } from './settingsRows';

export interface SettingsMenuItem {
  href: string;
  label: string;
  icon: string;
}

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  { href: '/settings/display', label: 'Display', icon: 'sun' },
  { href: '/settings/messenger', label: 'Messenger', icon: 'chat' },
  { href: '/settings/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/settings/wallet', label: 'Wallet', icon: 'wallet' },
  { href: '/settings/security', label: 'Security', icon: 'key' },
  { href: '/settings/experimental', label: 'Experimental', icon: 'beaker' },
  { href: '/settings/about', label: 'About', icon: 'questionMarkCircle' },
];

export function settingsMenuNode(): ListViewNode {
  return {
    type: 'ListView',
    children: SETTINGS_MENU_ITEMS.map((row) =>
      settingsNavRow({
        label: row.label,
        iconStart: row.icon,
        pressType: SETTINGS_NAV_PRESS,
        payload: { href: row.href },
      }),
    ),
  };
}
