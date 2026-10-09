import type { Href } from 'expo-router';
import { BoardHome, HomeScreen } from './home/HomeScreen';
import { WalletScreen } from './wallet/screen/WalletScreen';
import { SettingsMenu } from './settings/SettingsHub';
import { BOARD_ROUTE } from './tabs/splitRoutes';
import type { SimultaneousRefs } from './SwipeTabs.types';

export const TAB_ORDER = ['index', 'board', 'wallet', 'settings'] as const;
export type TabName = (typeof TAB_ORDER)[number];

export const TAB_HREF: Record<TabName, Href> = {
  index: '/',
  board: BOARD_ROUTE,
  wallet: '/wallet',
  settings: '/settings',
};

export const PAGES: Record<TabName, (props: { panRef?: SimultaneousRefs }) => React.ReactElement | null> = {
  index: HomeScreen,
  board: BoardHome,
  wallet: WalletScreen,
  settings: SettingsMenu,
};

export function indexOfPathname(pathname: string): number {
  if (pathname === '/' || pathname === '') return 0;
  if (pathname === BOARD_ROUTE) return 1;
  if (pathname.startsWith('/wallet')) return 2;
  if (pathname.startsWith('/settings')) return 3;
  return 0;
}

export const SWITCH_FRACTION = 0.2;
export const FLING_VELOCITY = 450;
