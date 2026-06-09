/** The ONE fixed top bar for the four main tabs.
 *
 *  Rendered as a sibling ABOVE the SwipeTabs pager (see (tabs)/_layout.tsx), so a
 *  horizontal tab-swipe (which translates the pager strip) and a vertical scroll
 *  inside a tab BOTH leave it untouched: it is not a child of the moving pager.
 *
 *  It mirrors the ACTIVE tab: the parent passes the active tab name (SwipeTabs is
 *  the source of truth for the index) and we render that tab's published slot
 *  (right-slot actions, or a full-bar override for Home's expanded search). The
 *  left identity is constant across all tabs, so the bar is literally the same
 *  Home bar with only its right slot swapping per tab. */

import { Topnav } from '../Topnav';
import type { TabName } from '../SwipeTabs.config';
import { useTopnavSlot } from './topnavSlots';

export function HoistedTopnav({ active }: { active: TabName }): React.ReactElement {
  const slot = useTopnavSlot(active);
  // Home's expanded search replaces the entire bar (identity included).
  if (slot?.override) return <>{slot.override}</>;
  return <Topnav right={slot?.right} />;
}
