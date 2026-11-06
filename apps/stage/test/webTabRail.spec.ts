import { describe, expect, test } from 'bun:test';
import { chatsTabOpensNewChat, homeTabPresentation } from '../components/tabs/WebTabRail.model';
import { newChatNav } from '../components/home/newChat.model';
import { homeViewAt, isBoardHome, isSplitRoute } from '../components/tabs/splitRoutes';

describe('home rail in Board mode', () => {
  test.each(['/board', '/channel/abc', '/new', '/contacts', '/wallet', '/settings'])(
    '%s opens the frontpage without changing mode',
    (pathname) => {
      const board = isBoardHome(pathname, 'board');
      expect(chatsTabOpensNewChat(pathname, true, board)).toBe(true);
      const nav = newChatNav(true, board, pathname);
      expect(nav).toEqual({ href: '/new', push: pathname === '/board' });
      expect(homeViewAt(nav.href)).toBeNull();
      expect(isBoardHome(nav.href, 'board')).toBe(true);
      expect(isSplitRoute(nav.href)).toBe(true);
    },
  );

  test('uses the existing Board icon and matching tooltip, then returns to Chats when the mode changes', () => {
    expect(homeTabPresentation(true)).toEqual({ icon: 'IconColumns3Wide', label: 'Board' });
    expect(homeTabPresentation(false)).toEqual({ icon: 'IconBubble3', label: 'Chats' });
  });
});

describe('unchanged Chats and phone navigation', () => {
  test.each(['/', '/channel/abc', '/new', '/contacts', '/wallet', '/settings'])('desktop Chats at %s still navigates home', (pathname) => {
    expect(chatsTabOpensNewChat(pathname, true, false)).toBe(false);
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
