import { BOARD_ROUTE } from './tabs/splitRoutes';
import { isMenuPageRoute } from './tabs/menuPages';

export const TAB_ORDER = ['index', 'contacts', 'wallet', 'settings'] as const;
export type TabName = (typeof TAB_ORDER)[number] | 'board';

export const TAB_HREF = { index: '/', board: BOARD_ROUTE, contacts: '/contacts', wallet: '/wallet', settings: '/settings' } as const;

export function homeTabIndex(pathname: string): number {
  if (pathname === '/contacts') return 1;
  if (pathname.startsWith('/wallet')) return 2;
  if (pathname.startsWith('/settings') || isMenuPageRoute(pathname)) return 3;
  return 0;
}

export function hasTabsPager(pathname: string, web: boolean): boolean {
  if (!web && pathname === '/contacts') return true;
  return !isMenuPageRoute(pathname) && (!web || !pathname.startsWith('/settings'));
}

export function homePageName(pathname: string, boardHome: boolean): TabName {
  const name = TAB_ORDER[homeTabIndex(pathname)] ?? 'index';
  return name === 'index' && boardHome ? 'board' : name;
}

export function swipedTabIndex(index: number, width: number, translation: number, velocity: number): number {
  'worklet';
  if (Math.abs(translation) <= width * 0.2 && Math.abs(velocity) <= 450) return index;
  if (translation < 0) return Math.min(index + 1, TAB_ORDER.length - 1);
  if (translation > 0) return Math.max(index - 1, 0);
  return index;
}
