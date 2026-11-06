import { describe, expect, test } from 'bun:test';
import { chatsTabOpensNewChat, homeTabPresentation } from '../components/tabs/WebTabRail.model';
import { newChatNav } from '../components/home/newChat.model';
import { homeViewAt, isBoardHome, isRailOnlyRoute, isSplitRoute } from '../components/tabs/splitRoutes';

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

  test('the phone home tab opens the composer only when already on Chats', () => {
    for (const board of [false, true]) {
      expect(chatsTabOpensNewChat('/', false, board)).toBe(true);
      for (const pathname of ['/board', '/channel/abc', '/new', '/wallet']) {
        expect(chatsTabOpensNewChat(pathname, false, board)).toBe(false);
      }
    }
    expect(chatsTabOpensNewChat('/', false)).toBe(true);
    expect(chatsTabOpensNewChat('/board', false)).toBe(false);
    expect(chatsTabOpensNewChat('/', true)).toBe(false);
  });
});
