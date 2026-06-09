/** Shared store for the single, hoisted Topnav (see (tabs)/_layout.tsx).
 *
 *  The Topnav is rendered ONCE, as a fixed sibling ABOVE the SwipeTabs pager, so
 *  neither a horizontal tab-swipe (which translates the pager strip) nor a
 *  vertical scroll inside a tab can move it. Because the bar lives outside the
 *  pages, each tab can no longer render its own contextual right-slot inline.
 *
 *  Instead every tab body PUBLISHES its current right-slot (and, for Home, an
 *  optional full-width override that replaces the whole bar while search is open)
 *  into this tiny store, keyed by tab index. The hoisted Topnav subscribes and
 *  renders ONLY the active tab's slot, so the left identity stays constant and
 *  the right actions swap to match the visible tab.
 *
 *  A plain module-level store + useSyncExternalStore keeps this dependency-free
 *  (no extra provider in the tree) and renders the bar synchronously with the
 *  publishing screen. */

import { useEffect, useSyncExternalStore } from 'react';
import type { TabName } from '../SwipeTabs.config';

/** What a tab contributes to the shared bar. */
export interface TopnavSlot {
  /** Contextual right-slot actions for this tab (icons). Omitted = none. */
  right?: React.ReactNode;
  /** Full-bar override: when set, the hoisted Topnav renders THIS instead of the
   *  identity+right bar (Home uses it for the expanded search field). */
  override?: React.ReactNode;
}

const slots: Partial<Record<TabName, TopnavSlot>> = {};
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Publish (or clear) the active slot for a tab. Called by each tab body via the
 *  `usePublishTopnavSlot` hook below; the hoisted bar reads it with
 *  `useTopnavSlot`. Identity comparison avoids redundant emits. */
export function setTopnavSlot(tab: TabName, slot: TopnavSlot | null): void {
  if (slot === null) {
    if (slots[tab] === undefined) return;
    delete slots[tab];
  } else {
    slots[tab] = slot;
  }
  emit();
}

/** Subscribe to a single tab's slot. The hoisted Topnav calls this with the
 *  ACTIVE tab so it always reflects the visible page's contextual actions. */
export function useTopnavSlot(tab: TabName): TopnavSlot | undefined {
  return useSyncExternalStore(
    subscribe,
    () => slots[tab],
    () => slots[tab],
  );
}

/** Tab-body helper: publish this tab's right-slot / override for as long as the
 *  body is mounted, and clear it on unmount. Re-publishes whenever the node
 *  identity changes (e.g. requestCount badge updates, search opens).
 *
 *  `enabled` (default true) lets a component that is shared between a pager tab
 *  and a non-tab route (ProfileScreen) opt OUT of touching the shared slot when
 *  it is the route variant, so a pushed /user/[address] screen never clobbers
 *  the Profile tab's published kebab. */
export function usePublishTopnavSlot(tab: TabName, slot: TopnavSlot, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    setTopnavSlot(tab, slot);
    return () => { setTopnavSlot(tab, null); };
    // `right`/`override` are the meaningful identities to react to.
  }, [tab, enabled, slot.right, slot.override]);
}
