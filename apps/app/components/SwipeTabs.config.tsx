/**
 * @file Static config for the SwipeTabs pager: tab order, expo-router hrefs,
 *  mounted page bodies, the pathname-to-index map, and swipe thresholds.
 */

import type { Href } from 'expo-router';

import { HomeScreen } from './tabs/HomeScreen';
import { ContactsScreen } from './ContactsScreen';
import { WalletScreen } from './tabs/WalletScreen';

/**
 * The shape accepted by an inner scrollable's `simultaneousHandlers` prop and
 *  by each tab body's `panRef` prop. Defined in the leaf SwipeTabs.types.ts so
 *  tab screens import it without cycling back into this config. Re-exported here
 *  for the existing import sites.
 */
export type { SimultaneousRefs } from './SwipeTabs.types';
import type { SimultaneousRefs } from './SwipeTabs.types';

/** Tab order = the order declared in `app/(tabs)/_layout.tsx`. Index 0..2. (Channels / Contacts / Wallet — search is unified into the Home bar.) Matches the footer order so swipe and tap agree. */
export const TAB_ORDER = ['index', 'contacts', 'wallet'] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** expo-router pathnames for each tab (the `(tabs)` group is path-transparent; `index` is the group root `/`). */
export const TAB_HREF: Record<TabName, Href> = {
  index: '/',
  contacts: '/contacts',
  wallet: '/wallet',
};

/**
 * The three tab bodies, mounted side-by-side in pager order. Mounting them all
 *  at once is fine (only three screens) and lets each keep its own scroll/state
 *  while the neighbour is already rendered during the drag — so it's visible the
 *  instant the finger moves.
 */
export const PAGES: Record<TabName, (props: { panRef?: SimultaneousRefs }) => React.ReactElement> = {
  index: HomeScreen,
  contacts: ContactsScreen,
  wallet: WalletScreen,
};

/** Map the focused pathname → pager index. Unknown / nested paths keep the current index (the pager isn't mounted off the tabs group anyway). */
export function indexOfPathname(pathname: string): number {
  if (pathname === '/' || pathname === '') return 0;
  if (pathname.startsWith('/contacts')) return 1;
  if (pathname.startsWith('/wallet')) return 2;
  return 0;
}

/** Switch tabs if dragged past this fraction of the screen width OR flung. */
export const SWITCH_FRACTION = 0.2;
export const FLING_VELOCITY = 450;
