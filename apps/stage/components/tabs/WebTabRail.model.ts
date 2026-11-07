import { PAGES } from './pages';

export function chatsTabOpensNewChat(pathname: string, wide: boolean, board = false): boolean {
  return wide ? board && pathname === PAGES.board.href : !board && pathname === PAGES.chats.href;
}

export function homeTabPresentation(board: boolean) {
  const { icon, label, href } = board ? PAGES.board : PAGES.chats;
  return { icon, label, href };
}
