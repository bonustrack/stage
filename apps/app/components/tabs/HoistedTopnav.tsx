/** The ONE fixed top bar for the four main tabs.
 *
 *  Rendered as a sibling ABOVE the SwipeTabs pager (see (tabs)/_layout.tsx), so a
 *  horizontal tab-swipe (which translates the pager strip) and a vertical scroll
 *  inside a tab BOTH leave it untouched: it is not a child of the moving pager.
 *
 *  It is UNIFORM across every tab: always the HOME bar (identity + search /
 *  requests / overflow). Only Home publishes the shared slot (and its expanded-
 *  search full-bar override); Wallet / Notifications / Profile show the exact same
 *  bar with no per-tab swapping. Per-tab actions live in each page's body now. */

import { Topnav } from '../Topnav';
import { useTopnavSlot } from './topnavSlots';

export function HoistedTopnav(): React.ReactElement {
  const slot = useTopnavSlot();
  // Home's expanded search replaces the entire bar (identity included).
  if (slot?.override) return <>{slot.override}</>;
  return <Topnav right={slot?.right} />;
}
