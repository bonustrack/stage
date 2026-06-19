/** Shared store for the single, hoisted Topnav (see (tabs)/_layout.tsx).
 *
 *  The Topnav is rendered ONCE, as a fixed sibling ABOVE the SwipeTabs pager, so
 *  neither a horizontal tab-swipe (which translates the pager strip) nor a
 *  vertical scroll inside a tab can move it.
 *
 *  The bar is UNIFORM across all four tabs: it is always the HOME bar (identity +
 *  search / requests / overflow). Only the Home screen publishes its slot here;
 *  every tab shows it identically. Home also publishes an optional full-width
 *  override that replaces the whole bar while its search field is open.
 *
 *  A plain module-level store + useSyncExternalStore keeps this dependency-free
 *  (no extra provider in the tree) and renders the bar synchronously with the
 *  publishing screen. */

import { useEffect, useSyncExternalStore } from 'react';

/** What Home contributes to the shared bar. */
export interface TopnavSlot {
  /** Right-slot actions (search / requests / overflow icons). */
  right?: React.ReactNode;
  /** Full-bar override: when set, the hoisted Topnav renders THIS instead of the
   *  identity+right bar (Home uses it for the expanded search field). */
  override?: React.ReactNode;
}

let slot: TopnavSlot | undefined;
const listeners = new Set<() => void>();

/** Emit helper. */
function emit(): void {
  for (const l of listeners) l();
}

/** Subscribe helper. */
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Read the shared (Home) slot. The hoisted Topnav calls this so every tab shows
 *  the same Home bar (identity + actions), never a per-tab variant. */
export function useTopnavSlot(): TopnavSlot | undefined {
  return useSyncExternalStore(subscribe, () => slot, () => slot);
}

/** Home-body helper: publish the shared right-slot / override for as long as the
 *  Home body is mounted, and clear it on unmount. Re-publishes whenever the node
 *  identity changes (e.g. requestCount badge updates, search opens). */
export function usePublishTopnavSlot(next: TopnavSlot): void {
  useEffect(() => {
    slot = next;
    emit();
    return () => { slot = undefined; emit(); };
  }, [next.right, next.override]);
}
