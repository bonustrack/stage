/** Cross-screen label-filter glue for the Home (Channels) tab.
 *
 *  A channel-card label chip (rendered by ChannelRow's LabelChips, used on the
 *  Channels tab AND a peer profile's Common Channels) is tappable. Tapping it
 *  navigates to the Channels tab and toggles that label in HomeScreen's enabled
 *  filter set, so the list narrows to chats carrying it. The actual filter UI is
 *  the horizontal chip bar under the search bar (HomeScreen.labelbar). This
 *  module only carries the cross-screen tap request into HomeScreen's state. */

import { useEffect } from 'react';
import {
  consumeLabelFilterRequest,
  subscribeLabelFilterRequest,
  clearPendingLabelFilter,
} from '../../lib/labelFilterRequest';
import { UNLABELED } from './HomeScreen.filter.types';
import type { LabelFilterValue } from './HomeScreen.filter.types';

/** A cross-screen request only ever carries a concrete label string (a tapped
 *  chip). The null / UNLABELED sentinels have no chip in the bar, so ignore
 *  them rather than toggling a non-existent filter. */
function asLabel(value: LabelFilterValue): string | null {
  return value != null && value !== UNLABELED ? value : null;
}

/** Apply cross-screen label-filter requests by toggling the tapped label into
 *  HomeScreen's enabled set. Honours a request pending on mount (chip tapped on
 *  another tab → navigated here) AND subscribes so an already-mounted Home
 *  updates live. */
export function useIncomingLabelFilter(toggleLabel: (label: string) => void): void {
  useEffect(() => {
    const pending = asLabel(consumeLabelFilterRequest()?.value ?? null);
    if (pending) toggleLabel(pending);
    return subscribeLabelFilterRequest(req => {
      const label = asLabel(req.value);
      if (label) toggleLabel(label);
      /** Applied live → drop the pending slot so a later remount won't re-apply. */
      clearPendingLabelFilter();
    });
    /** toggleLabel is recreated each render but stable in effect; mount-only. */
  }, []);
}
