/**
 * @file Proposals.hook — React bindings over the shared proposalsStore: useProposals
 *  drives the Proposals screen (current card, queue cursor, skip/advance/refresh)
 *  and useProposalCount is the cheap pending-count read for the Home banner.
 */

import { useCallback, useState, useSyncExternalStore } from 'react';
import { proposalsStore } from './Proposals.store';
import type { QueuedRequest } from './Proposals.queue';

/** Cheap pending-poll count for the Home banner. Re-renders only when the count changes. The store does the (cache-driven, debounced) scanning. */
export function useProposalCount(): number {
  return useSyncExternalStore(
    proposalsStore.subscribe,
    proposalsStore.getCount,
    proposalsStore.getCount,
  );
}

export interface ProposalsState {
  /** The request currently shown, or null when the queue is exhausted/empty. */
  current: QueuedRequest | null;
  /** True until the first queue build settles (initial spinner gate). */
  loading: boolean;
  /** 1-based position + total, for a "2 of 5" style affordance. */
  position: number;
  total: number;
  /** Advance past the current proposal (used by Skip + after vote/send). */
  advance: () => void;
  /** Re-scan all channels and reset the cursor (clears session skips). */
  refresh: () => void;
}

/** Provides the visible proposals queue and subscribes to the shared store. */
export function useProposals(): ProposalsState {
  /** Subscribe to the shared store; re-renders when the visible queue changes. */
  const queue = useSyncExternalStore(
    proposalsStore.subscribe,
    proposalsStore.getQueue,
    proposalsStore.getQueue,
  );
  const ready = useSyncExternalStore(
    proposalsStore.subscribe,
    proposalsStore.isReady,
    proposalsStore.isReady,
  );

  /**
   * Local cursor into the visible queue. The store filters skipped ids out of
   *  the queue, so advancing = skip the current id (store re-emits a shorter
   *  queue) and the cursor naturally lands on the next still-present entry. We
   *  keep a cursor only to show "N of M" while the head stays at index 0.
   */
  const [seen, setSeen] = useState(0);

  const advance = useCallback(() => {
    const cur = proposalsStore.getQueue()[0];
    if (cur) {
      proposalsStore.skip(cur.key); // store drops it -> next becomes head
      setSeen(s => s + 1);
    }
  }, []);

  const refresh = useCallback(() => {
    setSeen(0);
    proposalsStore.refresh();
  }, []);

  const remaining = queue.length;
  const total = seen + remaining;
  return {
    current: queue[0] ?? null,
    loading: !ready,
    position: remaining === 0 ? 0 : seen + 1,
    total,
    advance,
    refresh,
  };
}
