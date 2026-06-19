/**
 * @file HoistedTopnav — the one fixed top bar for the four main tabs, rendered as
 *  a sibling above the SwipeTabs pager so swipes and scrolls leave it untouched.
 *  Always the uniform Home bar; only Home publishes the shared slot/override.
 */

import { Topnav } from '../Topnav';
import { useTopnavSlot } from './topnavSlots';

/** Renders the top navigation bar hoisted from the active tab's slot. */
export function HoistedTopnav(): React.ReactElement {
  const slot = useTopnavSlot();
  // Home's expanded search replaces the entire bar (identity included).
  if (slot?.override) return <>{slot.override}</>;
  return <Topnav right={slot?.right} />;
}
