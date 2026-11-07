import { describe, expect, test } from 'bun:test';
import { PAGES } from '../components/tabs/pages';
import {
  channelRouteConvId,
  homeRouteOf,
  homeViewAt,
  isBoardHome,
  isRailOnlyRoute,
  isRailRoute,
  isSplitRoute,
  isTabRoute,
} from '../components/tabs/splitRoutes';

describe('isSplitRoute', () => {
  test('home, conversations, and direct messages split', () => {
    for (const path of ['/', '/channel/abc', '/boorger', '/fabien.eth', '/profile/boorger']) expect(isSplitRoute(path)).toBe(true);
    expect(isSplitRoute('/0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
  });

  test('the onboarding pages never split, even though they look like handles', () => {
    expect(isSplitRoute('/signup')).toBe(false);
    expect(isSplitRoute('/import')).toBe(false);
  });

  test('profiles, settings, wallet and the menu pages split', () => {
    for (const path of ['/profile/0xabc', '/settings', '/settings/security', '/wallet', '/wallet/send'])
      expect(isSplitRoute(path)).toBe(true);
    for (const path of ['/contacts', '/dashboard', '/storage', '/inbox', '/inbox/mail']) expect(isSplitRoute(path)).toBe(true);
  });

  test('add members and the contact scanner keep the sidebar', () => {
    expect(isSplitRoute('/add-members')).toBe(true);
    expect(isSplitRoute('/scan')).toBe(true);
  });

  test('other stack routes stay single-column', () => {
    expect(isSplitRoute('/user/abc')).toBe(false);
    expect(isSplitRoute('/board')).toBe(false);
  });

  test('the board page keeps the rail but not the channels pane, its channels still split', () => {
    expect(isSplitRoute(PAGES.board.href)).toBe(false);
    expect(isSplitRoute('/channel/abc')).toBe(true);
    expect(isSplitRoute('/new')).toBe(true);
  });
});

describe('channelRouteConvId', () => {
  test('reads the open channel', () => {
    expect(channelRouteConvId('/channel/abc')).toBe('abc');
  });

  test('is null on every other route', () => {
    for (const path of ['/channel/', '/channel/abc/more', '/channels/abc', '/']) expect(channelRouteConvId(path)).toBeNull();
  });
});

describe('isTabRoute', () => {
  test('Contacts is a tab page and Board keeps its existing route', () => {
    for (const path of ['/', '/board', '/wallet', '/contacts']) expect(isTabRoute(path)).toBe(true);
    for (const path of ['/wallet/send', '/settings/security']) expect(isTabRoute(path)).toBe(false);
  });
});

describe('isRailOnlyRoute', () => {
  test('only the board page keeps the rail without the channels pane', () => {
    expect(isRailOnlyRoute('/board')).toBe(true);
    expect(isRailOnlyRoute('/')).toBe(false);
    expect(isRailOnlyRoute('/channel/abc')).toBe(false);
  });

  test('the rail shows on split pages and on the board page only', () => {
    for (const path of ['/board', '/', '/channel/abc']) expect(isRailRoute(path)).toBe(true);
    for (const path of ['/signup', '/user/abc']) expect(isRailRoute(path)).toBe(false);
  });
});

describe('the board home', () => {
  test('the Chats and Board pages set the home view, other routes keep the last one', () => {
    expect(homeViewAt('/')).toBe('chats');
    expect(homeViewAt('/board')).toBe('board');
    expect(homeViewAt('/channel/abc')).toBeNull();
    expect(homeViewAt('/contacts')).toBeNull();
  });

  test('a channel opened from the board keeps the board beside it', () => {
    expect(isBoardHome('/board', 'chats')).toBe(true);
    expect(isBoardHome('/', 'board')).toBe(false);
    expect(isBoardHome('/channel/abc', 'board')).toBe(true);
    expect(isBoardHome('/channel/abc', 'chats')).toBe(false);
  });

  test('going home returns to the last home page', () => {
    expect(homeRouteOf('board')).toBe('/board');
    expect(homeRouteOf('chats')).toBe('/');
  });
});
