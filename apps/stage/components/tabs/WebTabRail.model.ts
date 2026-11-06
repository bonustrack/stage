export function chatsTabOpensNewChat(pathname: string, wide: boolean, board = false): boolean {
  return wide ? board : pathname === '/';
}

export function homeTabPresentation(board: boolean) {
  return board ? ({ icon: 'IconColumns3Wide', label: 'Board' } as const) : ({ icon: 'IconBubble3', label: 'Chats' } as const);
}
