import { describe, expect, test } from 'bun:test';
import { SETTINGS_MENU_ITEMS } from '../components/settings/SettingsMenu.model';

describe('settingsMenu', () => {
  test('menu items list the seven settings sections in order', () => {
    expect(SETTINGS_MENU_ITEMS).toEqual([
      { href: '/settings/profile', label: 'Profile', icon: 'IconPeopleCircle' },
      { href: '/settings/display', label: 'Display', icon: 'IconSun' },
      { href: '/settings/messenger', label: 'Messenger', icon: 'IconBubble3' },
      { href: '/settings/notifications', label: 'Notifications', icon: 'IconBell' },
      { href: '/settings/wallet', label: 'Wallet', icon: 'IconWallet4' },
      { href: '/settings/security', label: 'Security', icon: 'IconKey2' },
      { href: '/settings/about', label: 'About', icon: 'IconQuestionmarkCircle' },
    ]);
  });
});
