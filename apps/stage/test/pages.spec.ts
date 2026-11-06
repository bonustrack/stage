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
  PAGES,
} from '../components/tabs/pages';

describe('the tab bar and the pager', () => {
  test('the tab bar shows Chats, Contacts and Wallet, the pager swipes Chats, Board, Wallet and Settings', () => {
    expect(TAB_BAR_PAGES.map((page) => page.tabRoute)).toEqual(['index', 'contacts', 'wallet']);
    expect(TAB_BAR_PAGES.map((page) => page.label)).toEqual(['Chats', 'Contacts', 'Wallet']);
    expect(HIDDEN_TAB_ROUTES).toEqual(['board', 'settings']);
    expect(PAGER_ORDER).toEqual(['chats', 'board', 'wallet', 'settings']);
  });

  test('the pager shows the page of the route, Settings under a menu page and Chats elsewhere', () => {
    expect(homeTabIndex('/', false)).toBe(0);
    expect(homeTabIndex('/', true)).toBe(1);
    expect(homeTabIndex('/board', false)).toBe(1);
    expect(homeTabIndex('/wallet/send', false)).toBe(2);
    expect(homeTabIndex('/settings/display', false)).toBe(3);
    expect(homeTabIndex('/dashboard', false)).toBe(3);
    expect(homeTabIndex('/contacts', false)).toBe(3);
    expect(homeTabIndex('/channel/abc', true)).toBe(1);
    expect(homeTabIndex('/boorger', false)).toBe(0);
  });

  test('a chat with a person whose name starts like a page stays on Chats', () => {
    expect(homeTabIndex('/walletfan', false)).toBe(0);
    expect(activeTabOf('/walletfan', false)).toBe('chats');
    expect(activeTabOf('/settingsfan', false)).toBe('chats');
  });

  test('lights the tab of the page, Chats for the board, none for Settings and the developer pages', () => {
    expect(activeTabOf('/', false)).toBe('chats');
    expect(activeTabOf('/board', false)).toBe('chats');
    expect(activeTabOf('/channel/abc', true)).toBe('chats');
    expect(activeTabOf('/wallet', false)).toBe('wallet');
    expect(activeTabOf('/contacts', false)).toBe('contacts');
    expect(activeTabOf('/settings', false)).toBeNull();
    expect(activeTabOf('/inbox/mail', false)).toBeNull();
  });

  test('Settings renders in the pager natively and by its route on the web', () => {
    expect(rendererOf(PAGES.settings, false)).toBe('pager');
    expect(rendererOf(PAGES.settings, true)).toBe('route');
    expect(rendererOf(PAGES.wallet, true)).toBe('pager');
    expect(rendererOf(PAGES.contacts, false)).toBe('route');
  });
});

describe('restoring the last route', () => {
  test('skips home, Wallet, Settings and anything the app no longer serves', () => {
    for (const path of ['', '/', '/wallet', '/settings', '/accounts', '/(tabs)', '/requests/abc'])
      expect(isRestorableRoute(path)).toBe(false);
  });

  test('restores pages, chats and their sub pages', () => {
    for (const path of [
      '/wallet/send',
      '/settings/display',
      '/board',
      '/dashboard',
      '/inbox/mail',
      '/channel/abc',
      '/boorger',
      '/signup',
    ]) {
      expect(isRestorableRoute(path)).toBe(true);
    }
  });
});

describe('new chat', () => {
  test('is the homepage beside the chats list, and its own page otherwise', () => {
    expect(newChatHref(true, false)).toBe('/');
    expect(newChatHref(true, true)).toBe('/new');
    expect(newChatHref(false, false)).toBe('/new');
  });
});
