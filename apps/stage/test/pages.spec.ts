import { describe, expect, test } from 'bun:test';
import {
  HIDDEN_TAB_ROUTES,
  PAGER_ORDER,
  TAB_BAR_PAGES,
  activeTabOf,
  homeTabIndex,
  isRestorableRoute,
  newChatHref,
  rendererOf,
  shownPagerPage,
  PAGES,
} from '../components/tabs/pages';

describe('the tab bar and the pager', () => {
  test('the tab bar shows Chats, Contacts and Wallet, the pager swipes Chats, Contacts, Wallet and Settings', () => {
    expect(TAB_BAR_PAGES.map((page) => page.tabRoute)).toEqual(['index', 'contacts', 'wallet']);
    expect(TAB_BAR_PAGES.map((page) => page.label)).toEqual(['Chats', 'Contacts', 'Wallet']);
    expect(HIDDEN_TAB_ROUTES).toEqual(['board', 'settings']);
    expect(PAGER_ORDER).toEqual(['chats', 'contacts', 'wallet', 'settings']);
  });

  test('the pager shows the slot of the route: Board shares the home slot, Settings under a menu page, home elsewhere', () => {
    expect(homeTabIndex('/')).toBe(0);
    expect(homeTabIndex('/board')).toBe(0);
    expect(homeTabIndex('/contacts')).toBe(1);
    expect(homeTabIndex('/wallet/send')).toBe(2);
    expect(homeTabIndex('/settings/display')).toBe(3);
    expect(homeTabIndex('/dashboard')).toBe(3);
    expect(homeTabIndex('/channel/abc')).toBe(0);
    expect(homeTabIndex('/boorger')).toBe(0);
    expect(shownPagerPage('/', true)).toBe('board');
    expect(shownPagerPage('/channel/abc', true)).toBe('board');
    expect(shownPagerPage('/', false)).toBe('chats');
  });

  test('a chat with a person whose name starts like a page stays on Chats', () => {
    expect(homeTabIndex('/walletfan')).toBe(0);
    expect(activeTabOf('/walletfan')).toBe('chats');
    expect(activeTabOf('/settingsfan')).toBe('chats');
  });

  test('lights the tab of the page, Chats for the board, none for Settings and the developer pages', () => {
    expect(activeTabOf('/')).toBe('chats');
    expect(activeTabOf('/board')).toBe('chats');
    expect(activeTabOf('/channel/abc')).toBe('chats');
    expect(activeTabOf('/wallet')).toBe('wallet');
    expect(activeTabOf('/contacts')).toBe('contacts');
    expect(activeTabOf('/settings')).toBeNull();
    expect(activeTabOf('/inbox/mail')).toBeNull();
  });

  test('Settings and Contacts render in the pager natively and by their route on the web', () => {
    expect(rendererOf(PAGES.settings, false)).toBe('pager');
    expect(rendererOf(PAGES.settings, true)).toBe('route');
    expect(rendererOf(PAGES.contacts, false)).toBe('pager');
    expect(rendererOf(PAGES.contacts, true)).toBe('route');
    expect(rendererOf(PAGES.wallet, true)).toBe('pager');
  });
});

describe('restoring the last route', () => {
  test('skips home, Wallet, Settings and anything the app no longer serves', () => {
    for (const path of ['', '/', '/wallet', '/settings', '/accounts', '/(tabs)', '/requests/abc'])
      expect(isRestorableRoute(path)).toBe(false);
  });

  test('restores pages, chats and their sub pages', () => {
    for (const path of ['/wallet/send', '/settings/display', '/board', '/dashboard']) expect(isRestorableRoute(path)).toBe(true);
    for (const path of ['/inbox/mail', '/channel/abc', '/boorger', '/signup']) expect(isRestorableRoute(path)).toBe(true);
  });
});

describe('new chat', () => {
  test('is the homepage beside the chats list, and its own page otherwise', () => {
    expect(newChatHref(true, false)).toBe('/');
    expect(newChatHref(true, true)).toBe('/new');
    expect(newChatHref(false, false)).toBe('/new');
  });
});
