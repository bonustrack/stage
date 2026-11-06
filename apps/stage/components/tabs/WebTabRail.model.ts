import { BOARD_ROUTE, isRailOnlyRoute } from './splitRoutes';

export function chatsTabOpensNewChat(pathname: string, wide: boolean, board = false): boolean {
  return wide ? board && isRailOnlyRoute(pathname) : pathname === '/';
}

export function homeTabPresentation(board: boolean) {
  return board
    ? ({ icon: 'IconColumns3Wide', label: 'Board', href: BOARD_ROUTE } as const)
    : ({ icon: 'IconBubble3', label: 'Chats', href: '/' } as const);
}
