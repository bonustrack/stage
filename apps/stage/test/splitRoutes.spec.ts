import { describe, expect, test } from 'bun:test';
import {
  BOARD_ROUTE, channelRouteConvId, homeRouteOf, homeViewAt, isBoardHome, isRailOnlyRoute, isRailRoute, isSplitRoute, isTabRoute,
} from '../components/tabs/splitRoutes';

describe('isSplitRoute', () => {
  test('home, conversations, and direct messages split', () => {
    expect(isSplitRoute('/')).toBe(true);
    expect(isSplitRoute('/channel/abc')).toBe(true);
    expect(isSplitRoute('/0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    expect(isSplitRoute('/boorger')).toBe(true);
    expect(isSplitRoute('/fabien.eth')).toBe(true);
    expect(isSplitRoute('/profile/boorger')).toBe(true);
  });

  test('the onboarding pages never split, even though they look like handles', () => {
    expect(isSplitRoute('/signup')).toBe(false);
    expect(isSplitRoute('/import')).toBe(false);
  });

  test('profiles, settings, wallet and contacts split', () => {
    expect(isSplitRoute('/profile/0xabc')).toBe(true);
    expect(isSplitRoute('/settings')).toBe(true);
    expect(isSplitRoute('/settings/security')).toBe(true);
    expect(isSplitRoute('/wallet')).toBe(true);
    expect(isSplitRoute('/wallet/send')).toBe(true);
    expect(isSplitRoute('/contacts')).toBe(true);
  });

  test('add members keeps the sidebar', () => {
    expect(isSplitRoute('/add-members')).toBe(true);
  });

  test('other stack routes stay single-column', () => {
    expect(isSplitRoute('/user/abc')).toBe(false);
    expect(isSplitRoute('/board')).toBe(false);
  });

  test('the board page keeps the rail but not the channels pane, its channels still split', () => {
    expect(isSplitRoute(BOARD_ROUTE)).toBe(false);
    expect(isSplitRoute('/channel/abc')).toBe(true);
    expect(isSplitRoute('/new')).toBe(true);
  });
});

describe('channelRouteConvId', () => {
  test('reads the open channel', () => {
    expect(channelRouteConvId('/channel/abc')).toBe('abc');
  });

  test('is null on every other route', () => {
    expect(channelRouteConvId('/channel/')).toBeNull();
    expect(channelRouteConvId('/channel/abc/more')).toBeNull();
    expect(channelRouteConvId('/channels/abc')).toBeNull();
    expect(channelRouteConvId('/')).toBeNull();
  });
});

describe('isTabRoute', () => {
  test('only the four tab pages count, Board included and Contacts no longer', () => {
    expect(isTabRoute('/')).toBe(true);
    expect(isTabRoute('/board')).toBe(true);
    expect(isTabRoute('/wallet')).toBe(true);
    expect(isTabRoute('/contacts')).toBe(false);
    expect(isTabRoute('/wallet/send')).toBe(false);
    expect(isTabRoute('/settings/security')).toBe(false);
  });
});

describe('isRailOnlyRoute', () => {
  test('only the board page keeps the rail without the channels pane', () => {
    expect(isRailOnlyRoute('/board')).toBe(true);
    expect(isRailOnlyRoute('/')).toBe(false);
    expect(isRailOnlyRoute('/channel/abc')).toBe(false);
  });

  test('the rail shows on split pages and on the board page only', () => {
    expect(isRailRoute('/board')).toBe(true);
    expect(isRailRoute('/')).toBe(true);
    expect(isRailRoute('/channel/abc')).toBe(true);
    expect(isRailRoute('/signup')).toBe(false);
    expect(isRailRoute('/user/abc')).toBe(false);
  });
});

describe('the board home', () => {
  test('the Chats and Board pages set the home view, other routes keep the last one', () => {
    expect(homeViewAt('/')).toBe('chats');
    expect(homeViewAt('/board')).toBe('board');
    expect(homeViewAt('/channel/abc')).toBeNull();
    expect(homeViewAt('/settings/contacts')).toBeNull();
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
