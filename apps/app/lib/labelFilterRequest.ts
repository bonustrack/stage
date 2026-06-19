/** @file Module-level pub/sub that carries a one-shot "apply this label filter on the Channels tab" request from a tapped label chip to HomeScreen. */

import type { LabelFilterValue } from '../components/tabs/HomeScreen.filter.types';

/** The most recent pending request, or null when there's nothing to apply. A request carries a monotonically bumped `seq` so two taps of the SAME label in a row still notify (the value would otherwise compare equal). */
let pending: { value: LabelFilterValue; seq: number } | null = null;
let seq = 0;
const listeners = new Set<(req: { value: LabelFilterValue; seq: number }) => void>();

/** Queue a label filter to apply on the Channels tab + notify HomeScreen if it's already mounted. The caller is responsible for the actual navigation to the Home tab (expo-router) — this only carries the value. */
export function requestLabelFilter(value: LabelFilterValue): void {
  const req = { value, seq: ++seq };
  pending = req;
  for (const l of listeners) l(req);
}

/** Consume the pending request (returns it and clears the slot), or null. Called by HomeScreen on mount so a chip tapped on another tab is honoured once Home mounts/focuses. */
export function consumeLabelFilterRequest(): { value: LabelFilterValue; seq: number } | null {
  const req = pending;
  pending = null;
  return req;
}

/** Subscribe to live requests (HomeScreen, while mounted). Returns an unsubscribe. Listeners should clear the pending slot via the seq they handle so a later remount doesn't re-consume the same request. */
export function subscribeLabelFilterRequest(
  l: (req: { value: LabelFilterValue; seq: number }) => void,
): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Clear any pending request without consuming it (used by HomeScreen once it has applied a live request, so a remount won't re-apply it). */
export function clearPendingLabelFilter(): void { pending = null; }
