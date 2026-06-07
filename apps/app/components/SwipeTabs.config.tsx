/** Static config for the tabs pager (see SwipeTabs.tsx): the tab order, their
 *  expo-router hrefs, the mounted page bodies, the pathname→index map, and the
 *  swipe thresholds. Split out to keep SwipeTabs.tsx under the line cap. */

import type { Href } from 'expo-router';

import { HomeScreen } from './tabs/HomeScreen';
import { WalletScreen } from './tabs/WalletScreen';
import { ProfileTabScreen } from './tabs/ProfileTab';
import { NotificationsScreen } from './tabs/NotificationsScreen';

/** The shape accepted by an inner scrollable's `simultaneousHandlers` prop and
 *  by each tab body's `panRef` prop. Defined in the leaf SwipeTabs.types.ts so
 *  tab screens import it without cycling back into this config. Re-exported here
 *  for the existing import sites. */
export type { SimultaneousRefs } from './SwipeTabs.types';
import type { SimultaneousRefs } from './SwipeTabs.types';

/** Tab order = the order declared in `app/(tabs)/_layout.tsx`. Index 0..3. */
// (Home / Wallet / Notifications / Profile — search is unified into the Home bar.)
export const TAB_ORDER = ['index', 'wallet', 'notifications', 'profile'] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** expo-router pathnames for each tab (the `(tabs)` group is path-transparent;
 *  `index` is the group root `/`). */
export const TAB_HREF: Record<TabName, Href> = {
  index: '/',
  wallet: '/wallet',
  profile: '/profile',
  notifications: '/notifications',
};

/** The four tab bodies, mounted side-by-side in pager order. Mounting all four
 *  at once is fine (only four screens) and lets each keep its own scroll/state
 *  while the neighbour is already rendered during the drag — so it's visible the
 *  instant the finger moves. */
export const PAGES: Record<TabName, (props: { panRef?: SimultaneousRefs }) => React.ReactElement> = {
  index: HomeScreen,
  wallet: WalletScreen,
  profile: ProfileTabScreen,
  notifications: NotificationsScreen,
};

/** Map the focused pathname → pager index. Unknown / nested paths keep the
 *  current index (the pager isn't mounted off the tabs group anyway). */
export function indexOfPathname(pathname: string): number {
  if (pathname === '/' || pathname === '') return 0;
  if (pathname.startsWith('/wallet')) return 1;
  if (pathname.startsWith('/notifications')) return 2;
  if (pathname.startsWith('/profile')) return 3;
  return 0;
}

/** Switch tabs if dragged past this fraction of the screen width OR flung. */
export const SWITCH_FRACTION = 0.2;
export const FLING_VELOCITY = 450;
