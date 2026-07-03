import { describe, expect, test } from 'bun:test';
import { SETTINGS_MENU_ITEMS, settingsMenuNode } from '../views/settings/settingsMenu';
import { SETTINGS_NAV_PRESS } from '../views/actions';

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

  test('node is a ListView with one nav row per item carrying the href payload', () => {
    const node = settingsMenuNode();
    expect(node.type).toBe('ListView');
    expect(node.children).toHaveLength(SETTINGS_MENU_ITEMS.length);
    const first = node.children[0];
    expect(first?.onClickAction).toEqual({
      type: SETTINGS_NAV_PRESS,
      payload: { href: '/settings/display' },
    });
  });
});
