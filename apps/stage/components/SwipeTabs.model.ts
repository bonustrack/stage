import { BOARD_ROUTE } from './tabs/splitRoutes';
import { isMenuPageRoute } from './tabs/menuPages';
import { WALLET_ENABLED } from '../lib/features';

const HOME_TABS = ['index', 'contacts', 'wallet', 'settings'] as const;
type HomeTab = (typeof HOME_TABS)[number];
export type TabName = HomeTab | 'board';

export function tabOrder(wallet: boolean): readonly HomeTab[] {
  return HOME_TABS.filter((tab) => wallet || tab !== 'wallet');
}

export const TAB_ORDER = tabOrder(WALLET_ENABLED);

export const TAB_HREF = { index: '/', board: BOARD_ROUTE, contacts: '/contacts', wallet: '/wallet', settings: '/settings' } as const;

function homeTabAt(pathname: string): HomeTab {
  if (pathname === '/contacts') return 'contacts';
  if (pathname.startsWith('/wallet')) return 'wallet';
  if (pathname.startsWith('/settings') || isMenuPageRoute(pathname)) return 'settings';
  return 'index';
}

export function tabIndexIn(order: readonly HomeTab[], pathname: string): number {
  return Math.max(0, order.indexOf(homeTabAt(pathname)));
}

export function homeTabIndex(pathname: string): number {
  return tabIndexIn(TAB_ORDER, pathname);
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
