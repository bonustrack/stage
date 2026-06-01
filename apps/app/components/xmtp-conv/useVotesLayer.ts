/** Optimistic poll-vote layer for the XMTP conversation screen — extracted from
 *  app/xmtp/[convId].tsx verbatim (phase-2 lint split). */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { xmtpVote } from '../../lib/xmtp';
import type { HistoryEntry } from '../../lib/types';
import { pollsInFeed } from './feed-helpers';

export function useVotesLayer(
  activeLine: string,
  events: HistoryEntry[],
  votes: Map<string, Map<number, Set<string>>>,
  ownVotes: Map<string, Set<number>>,
  myUri: string,
) {
  /** Optimistic poll selection: pollMessageId → Set<optionIndex> the local user
   *  just tapped, applied instantly over the confirmed tally until the live
   *  stream echoes the vote reaction back (then the memoized `ownVotes` carries
   *  it and we drop the override). */
  const [optimisticVotes, setOptimisticVotes] = useState<Map<string, Set<number>>>(new Map());

  /** Once the confirmed tally matches an optimistic selection (same set of
   *  indices), drop the override so the bubble reads purely off the live feed. */
  useEffect(() => {
    setOptimisticVotes(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map<string, Set<number>>();
      for (const [pollId, sel] of prev) {
        const confirmed = ownVotes.get(pollId) ?? new Set<number>();
        const same = sel.size === confirmed.size && [...sel].every(i => confirmed.has(i));
        if (same) { changed = true; continue; }
        next.set(pollId, sel);
      }
      return changed ? next : prev;
    });
  }, [ownVotes]);

  /** Display tallies merge the optimistic selection over the confirmed one so a
   *  tapped option flips instantly: the local voter is added to / removed from
   *  the per-option voter sets, and ownVotes reflects the pending choice. */
  const displayOwnVotes = useMemo(() => {
    if (optimisticVotes.size === 0) return ownVotes;
    const merged = new Map(ownVotes);
    for (const [pollId, sel] of optimisticVotes) merged.set(pollId, sel);
    return merged;
  }, [ownVotes, optimisticVotes]);
  const displayVotes = useMemo(() => {
    if (optimisticVotes.size === 0) return votes;
    const merged = new Map<string, Map<number, Set<string>>>();
    for (const [pollId, tally] of votes) merged.set(pollId, new Map([...tally].map(([i, s]) => [i, new Set(s)])));
    for (const [pollId, sel] of optimisticVotes) {
      const confirmedOwn = ownVotes.get(pollId) ?? new Set<number>();
      let tally = merged.get(pollId);
      if (!tally) { tally = new Map(); merged.set(pollId, tally); }
      /** Remove me from options I no longer hold, add me to the pending ones. */
      for (const idx of confirmedOwn) if (!sel.has(idx)) tally.get(idx)?.delete(myUri);
      for (const idx of sel) {
        let s = tally.get(idx);
        if (!s) { s = new Set(); tally.set(idx, s); }
        s.add(myUri);
      }
    }
    return merged;
  }, [votes, optimisticVotes, ownVotes, myUri]);

  const onVote = useCallback((pollMessageId: string, optionIndex: number, action: 'added' | 'removed') => {
    const multi = pollsInFeed(events).get(pollMessageId) === true;
    const current = optimisticVotes.get(pollMessageId)
      ?? ownVotes.get(pollMessageId)
      ?? new Set<number>();
    const next = new Set(current);
    if (action === 'removed') {
      next.delete(optionIndex);
    } else if (multi) {
      next.add(optionIndex);
    } else {
      next.clear();
      next.add(optionIndex);
    }
    setOptimisticVotes(prev => { const m = new Map(prev); m.set(pollMessageId, next); return m; });

    const undo = (): void => setOptimisticVotes(prev => {
      const m = new Map(prev); m.delete(pollMessageId); return m;
    });
    /** Single-select switch: retract every previously-held option that isn't the
     *  new pick so other clients don't double-count. */
    if (!multi && action === 'added') {
      for (const prevIdx of current) {
        if (prevIdx !== optionIndex) {
          void xmtpVote(activeLine, pollMessageId, prevIdx, 'removed')
            .catch((e: unknown) => console.warn('xmtp vote-retract failed', e));
        }
      }
    }
    void xmtpVote(activeLine, pollMessageId, optionIndex, action)
      .catch((e: unknown) => { console.warn('xmtp vote failed', e); undo(); });
  }, [activeLine, events, optimisticVotes, ownVotes]);

  return { displayVotes, displayOwnVotes, onVote };
}
