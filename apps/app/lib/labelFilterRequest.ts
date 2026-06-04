/** Cross-screen "apply this label filter on the Channels tab" channel.
 *
 *  A channel-card label chip (rendered by ChannelRow's LabelChips, used on BOTH
 *  the Channels tab and a peer profile's Common Channels) is tappable. Tapping
 *  it navigates to the Channels (Home) tab with that label as the active filter.
 *  The navigation is plain expo-router; this tiny module-level observable is how
 *  the requested filter value crosses from the tap site to HomeScreen, which
 *  owns the actual `labelFilter` state.
 *
 *  Mirrors the lightweight pub/sub style of lib/channelsCache (module-level
 *  value + Set of listeners) rather than pulling in a store library. A request
 *  is a one-shot: HomeScreen reads the pending value (on mount AND via the
 *  subscription, so an already-mounted Home updates live) and clears it so the
 *  same chip tap doesn't re-apply on a later remount. */

import type { LabelFilterValue } from '../components/tabs/HomeScreen.filter.types';

/** The most recent pending request, or null when there's nothing to apply. A
 *  request carries a monotonically bumped `seq` so two taps of the SAME label
 *  in a row still notify (the value would otherwise compare equal). */
let pending: { value: LabelFilterValue; seq: number } | null = null;
let seq = 0;
const listeners = new Set<(req: { value: LabelFilterValue; seq: number }) => void>();

/** Queue a label filter to apply on the Channels tab + notify HomeScreen if it's
 *  already mounted. The caller is responsible for the actual navigation to the
 *  Home tab (expo-router) — this only carries the value. */
export function requestLabelFilter(value: LabelFilterValue): void {
  const req = { value, seq: ++seq };
  pending = req;
  for (const l of listeners) l(req);
}

/** Consume the pending request (returns it and clears the slot), or null. Called
 *  by HomeScreen on mount so a chip tapped on another tab is honoured once Home
 *  mounts/focuses. */
export function consumeLabelFilterRequest(): { value: LabelFilterValue; seq: number } | null {
  const req = pending;
  pending = null;
  return req;
}

/** Subscribe to live requests (HomeScreen, while mounted). Returns an
 *  unsubscribe. Listeners should clear the pending slot via the seq they handle
 *  so a later remount doesn't re-consume the same request. */
export function subscribeLabelFilterRequest(
  l: (req: { value: LabelFilterValue; seq: number }) => void,
): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Clear any pending request without consuming it (used by HomeScreen once it
 *  has applied a live request, so a remount won't re-apply it). */
export function clearPendingLabelFilter(): void { pending = null; }
