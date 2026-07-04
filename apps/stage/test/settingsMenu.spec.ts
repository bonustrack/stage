import { describe, expect, test } from 'bun:test';
import { SETTINGS_MENU_ITEMS } from '../views/settings/settingsMenu';

describe('settingsMenu', () => {
  test('menu items list the seven settings sections in order', () => {
    expect(SETTINGS_MENU_ITEMS).toEqual([
      { href: '/settings/display', label: 'Display', icon: 'sun' },
      { href: '/settings/messenger', label: 'Messenger', icon: 'chat' },
      { href: '/settings/notifications', label: 'Notifications', icon: 'bell' },
      { href: '/settings/wallet', label: 'Wallet', icon: 'wallet' },
      { href: '/settings/security', label: 'Security', icon: 'key' },
      { href: '/settings/experimental', label: 'Experimental', icon: 'beaker' },
      { href: '/settings/about', label: 'About', icon: 'questionMarkCircle' },
    ]);
  });
});
