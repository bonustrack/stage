import { describe, expect, test } from 'bun:test';
import { chatsTabOpensNewChat, homeTabPresentation } from '../components/tabs/WebTabRail.model';
import { newChatNav } from '../components/newChat/newChat.model';
import { homeViewAt, isBoardHome, isRailOnlyRoute, isSplitRoute } from '../components/tabs/splitRoutes';
import { homeViewNavigation, type HomeViewNavigationState } from '../components/tabs/homeViewNavigation.model';

describe('home rail in Board mode', () => {
  test.each([
    '/channel/abc',
    '/new',
    '/contacts',
    '/wallet',
    '/wallet/send',
    '/settings',
    '/settings/security',
    '/dashboard',
    '/inbox/mail',
  ])('%s opens the full-page Board without changing mode', (pathname) => {
    const board = isBoardHome(pathname, 'board');
    expect(chatsTabOpensNewChat(pathname, true, board)).toBe(false);
    const { href } = homeTabPresentation(board);
    expect(href).toBe('/board');
    expect(isRailOnlyRoute(href)).toBe(true);
    expect(homeViewAt(href)).toBe('board');
    expect(isBoardHome(href, 'board')).toBe(true);
  });

  test('only the full-page Board opens the composer beside Board', () => {
    expect(chatsTabOpensNewChat('/board', true, true)).toBe(true);
    const nav = newChatNav(true, true, '/board');
    expect(nav).toEqual({ href: '/new', push: true });
    expect(homeViewAt(nav.href)).toBeNull();
    expect(isBoardHome(nav.href, 'board')).toBe(true);
    expect(isSplitRoute(nav.href)).toBe(true);
    expect(chatsTabOpensNewChat(nav.href, true, true)).toBe(false);
    expect(homeTabPresentation(true).href).toBe('/board');
  });

  test.each(['/board/', '/board/child', '/boards', '/boardwalk'])('%s is not the canonical full-page Board pathname', (pathname) => {
    expect(chatsTabOpensNewChat(pathname, true, true)).toBe(false);
    expect(homeTabPresentation(true).href).toBe('/board');
  });

  test('uses the existing Board icon and matching tooltip, then returns to Chats when the mode changes', () => {
    expect(homeTabPresentation(true)).toEqual({ icon: 'IconColumns3Wide', label: 'Board', href: '/board' });
    expect(homeTabPresentation(false)).toEqual({ icon: 'IconBubble3', label: 'Chats', href: '/' });
  });
});

describe('unchanged Chats and phone navigation', () => {
  test.each(['/', '/channel/abc', '/new', '/contacts', '/wallet', '/settings'])('desktop Chats at %s still navigates home', (pathname) => {
    expect(chatsTabOpensNewChat(pathname, true, false)).toBe(false);
    expect(homeTabPresentation(false).href).toBe('/');
    expect(newChatNav(true, false, pathname)).toEqual({ href: '/', push: false });
  });

  test('the phone home tab opens the composer only when already on Chats in Chats mode', () => {
    expect(chatsTabOpensNewChat('/', false, false)).toBe(true);
    expect(chatsTabOpensNewChat('/', false, true)).toBe(false);
    for (const board of [false, true]) {
      for (const pathname of ['/board', '/channel/abc', '/new', '/contacts', '/wallet', '/settings']) {
        expect(chatsTabOpensNewChat(pathname, false, board)).toBe(false);
      }
    }
    expect(chatsTabOpensNewChat('/', false)).toBe(true);
    expect(chatsTabOpensNewChat('/board', false)).toBe(false);
    expect(chatsTabOpensNewChat('/', true)).toBe(false);
  });
});

describe('phone home footer follows the selected mode', () => {
  test.each(['board', 'chats'] as const)('%s survives a cold restore and home reselect', (view) => {
    const previous: HomeViewNavigationState = { epoch: 0, pathname: null, restoringFrom: null };
    const initial = homeViewNavigation('/', view, previous, 0);
    const pathname = initial.restore ?? '/';
    const home = homeTabPresentation(isBoardHome(pathname, view));
    expect(home.label).toBe(view === 'board' ? 'Board' : 'Chats');
    expect(home.icon).toBe(view === 'board' ? 'IconColumns3Wide' : 'IconBubble3');
    const href: string = home.href;
    expect(href).toBe(pathname);
    expect(homeViewNavigation(home.href, view, initial.state, 0).remember).toBeNull();
    expect(chatsTabOpensNewChat(pathname, false, view === 'board')).toBe(view === 'chats');
  });

  test.each(['board', 'chats'] as const)('returning from another tab preserves %s', (view) => {
    const home = homeTabPresentation(view === 'board');
    for (const pathname of ['/contacts', '/wallet', '/settings']) {
      const previous: HomeViewNavigationState = { epoch: 0, pathname: home.href, restoringFrom: null };
      const away = homeViewNavigation(pathname, view, previous, 0);
      expect(away.remember).toBeNull();
      expect(homeTabPresentation(isBoardHome(pathname, view))).toEqual(home);
      expect(chatsTabOpensNewChat(pathname, false, view === 'board')).toBe(false);
      const returned = homeViewNavigation(home.href, view, away.state, 0);
      expect(returned.restore).toBeNull();
      expect(returned.remember).toBe(view);
    }
  });

  test('switching either direction updates the footer presentation and destination together', () => {
    for (const view of ['board', 'chats', 'board'] as const) {
      const home = homeTabPresentation(view === 'board');
      expect(homeViewAt(home.href)).toBe(view);
      expect(home.label).toBe(view === 'board' ? 'Board' : 'Chats');
      expect(home.icon).toBe(view === 'board' ? 'IconColumns3Wide' : 'IconBubble3');
    }
  });
});
