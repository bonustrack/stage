/** State hook for the Proposals tab: holds the oldest-first proposal queue, the
 *  cursor into it, and the skip/advance/refresh actions.
 *
 *  The queue is rebuilt from the channels-list cache (the same rows the Home tab
 *  renders) whenever the tab gains focus or the cache changes. Skipping/voting
 *  advances the cursor; "skipped" ids are remembered for the session so a skipped
 *  poll doesn't reappear when the queue is rebuilt (e.g. after a vote elsewhere),
 *  but they DO return on a manual refresh / next app run. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getCachedRows, subscribeCachedRows, type CachedRow } from '../../modules/messaging';
import { buildProposalQueue, type QueuedProposal } from './Proposals.queue';

export interface ProposalsState {
  /** The proposal currently shown, or null when the queue is exhausted/empty. */
  current: QueuedProposal | null;
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

export function useProposals(): ProposalsState {
  const [queue, setQueue] = useState<QueuedProposal[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  /** Conv ids skipped this session — filtered out of every rebuilt queue so a
   *  skipped poll never jumps back in front of the cursor. */
  const skipped = useRef<Set<string>>(new Set());
  /** Guards against a stale async build landing after a newer one (focus + cache
   *  change can race). Only the latest build's result is applied. */
  const buildId = useRef(0);

  const rebuild = useCallback((rows: CachedRow[] | null, clearSkips: boolean) => {
    if (clearSkips) skipped.current = new Set();
    const id = ++buildId.current;
    void buildProposalQueue(rows ?? []).then(q => {
      if (id !== buildId.current) return;
      const visible = q.filter(p => !skipped.current.has(p.convId));
      setQueue(visible);
      setCursor(0);
      setLoading(false);
    });
  }, []);

  /** Rebuild on focus (cheap, local-first) so a poll voted/closed elsewhere is
   *  reflected when Less swipes back to this tab. */
  useFocusEffect(useCallback(() => {
    setLoading(true);
    rebuild(getCachedRows(), false);
  }, [rebuild]));

  /** Live: rebuild when the channels cache changes (new poll arrives / channel
   *  archived). Keeps the cursor at 0 — the new oldest pending poll leads. */
  useEffect(() => subscribeCachedRows(rows => rebuild(rows, false)), [rebuild]);

  const advance = useCallback(() => {
    const cur = queue[cursor];
    if (cur) skipped.current.add(cur.convId);
    setCursor(c => c + 1);
  }, [queue, cursor]);

  const refresh = useCallback(() => {
    setLoading(true);
    rebuild(getCachedRows(), true);
  }, [rebuild]);

  return {
    current: queue[cursor] ?? null,
    loading,
    position: queue.length === 0 ? 0 : Math.min(cursor + 1, queue.length),
    total: queue.length,
    advance,
    refresh,
  };
}
