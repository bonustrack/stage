export function chatsTabOpensNewChat(pathname: string, wide: boolean): boolean {
  return !wide && pathname === '/';
}
