
import type { Href } from 'expo-router';

import { HomeScreen } from './tabs/HomeScreen';
import { ContactsScreen } from './ContactsScreen';
import { WalletScreen } from './tabs/WalletScreen';

export type { SimultaneousRefs } from './SwipeTabs.types';
import type { SimultaneousRefs } from './SwipeTabs.types';

export const TAB_ORDER = ['index', 'contacts', 'wallet'] as const;
export type TabName = (typeof TAB_ORDER)[number];

export const TAB_HREF: Record<TabName, Href> = {
  index: '/',
  contacts: '/contacts',
  wallet: '/wallet',
};

export const PAGES: Record<TabName, (props: { panRef?: SimultaneousRefs }) => React.ReactElement> = {
  index: HomeScreen,
  contacts: ContactsScreen,
  wallet: WalletScreen,
};

export function indexOfPathname(pathname: string): number {
  if (pathname === '/' || pathname === '') return 0;
  if (pathname.startsWith('/contacts')) return 1;
  if (pathname.startsWith('/wallet')) return 2;
  return 0;
}

export const SWITCH_FRACTION = 0.2;
export const FLING_VELOCITY = 450;
