import { describe, expect, test } from 'bun:test';
import { channelRouteConvId, isRailOnlyRoute, isSplitRoute, isTabRoute } from '../components/tabs/splitRoutes';

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

  test('the home page takes the full width when the board is the home view, channels still split', () => {
    expect(isSplitRoute('/', true)).toBe(false);
    expect(isSplitRoute('/channel/abc', true)).toBe(true);
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
  test('only the four tab pages count', () => {
    expect(isTabRoute('/')).toBe(true);
    expect(isTabRoute('/wallet')).toBe(true);
    expect(isTabRoute('/wallet/send')).toBe(false);
    expect(isTabRoute('/settings/security')).toBe(false);
  });
});

describe('isRailOnlyRoute', () => {
  test('only the home page in board view keeps the rail without the channels pane', () => {
    expect(isRailOnlyRoute('/', true)).toBe(true);
    expect(isRailOnlyRoute('/', false)).toBe(false);
    expect(isRailOnlyRoute('/channel/abc', true)).toBe(false);
  });
});
