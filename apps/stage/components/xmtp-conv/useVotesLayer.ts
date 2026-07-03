import { useCallback, useEffect, useMemo, useState } from 'react';
import { xmtpVote, xmtpOpenAnswer } from '../../modules/messaging';
import type { HistoryEntry } from '@stage-labs/client/types';
import { pollQuestionsInFeed } from './feed-helpers';

type Votes = Map<string, Map<number, Map<number, Set<string>>>>;
type Own = Map<string, Map<number, Set<number>>>;
type OpenAnswers = Map<string, Map<number, Map<string, { text: string; ts: string }>>>;
type PollsInFeed = ReturnType<typeof pollQuestionsInFeed>;

const ck = (pollId: string, q: number): string => `${pollId}:${q}`;
const unCk = (k: string): { pollId: string; q: number } => {
  const i = k.lastIndexOf(':');
  return { pollId: k.slice(0, i), q: Number(k.slice(i + 1)) };
};

const cloneVotes = (votes: Votes): Votes => {
  const merged: Votes = new Map();
  for (const [pollId, byQ] of votes) {
    merged.set(pollId, new Map([...byQ].map(([qi, t]) => [qi, new Map([...t].map(([i, s]) => [i, new Set(s)]))])));
  }
  return merged;
};

const ensureTally = (merged: Votes, pollId: string, q: number): Map<number, Set<string>> => {
  let byQ = merged.get(pollId);
  if (!byQ) { byQ = new Map(); merged.set(pollId, byQ); }
  let tally = byQ.get(q);
  if (!tally) { tally = new Map(); byQ.set(q, tally); }
  return tally;
};

const applyOptimisticVote = (
  tally: Map<number, Set<string>>,
  confirmed: Set<number>,
  sel: Set<number>,
  myUri: string,
): void => {
  for (const idx of confirmed) if (!sel.has(idx)) tally.get(idx)?.delete(myUri);
  for (const idx of sel) {
    let s = tally.get(idx);
    if (!s) { s = new Set(); tally.set(idx, s); }
    s.add(myUri);
  }
};

function useOptimisticVotes(
  activeLine: string,
  votes: Votes,
  ownVotes: Own,
  pollsInFeed: PollsInFeed,
  myUri: string,
) {
  const [optimistic, setOptimistic] = useState<Map<string, Set<number>>>(new Map());

  const confirmedOwn = useCallback((pollId: string, q: number): Set<number> =>
    ownVotes.get(pollId)?.get(q) ?? new Set<number>(), [ownVotes]);

  useEffect(() => {
    setOptimistic(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map<string, Set<number>>();
      for (const [key, sel] of prev) {
        const { pollId, q } = unCk(key);
        const conf = ownVotes.get(pollId)?.get(q) ?? new Set<number>();
        const same = sel.size === conf.size && [...sel].every(i => conf.has(i));
        if (same) { changed = true; continue; }
        next.set(key, sel);
      }
      return changed ? next : prev;
    });
  }, [ownVotes]);

  const displayOwnVotes = useMemo<Own>(() => {
    if (optimistic.size === 0) return ownVotes;
    const merged: Own = new Map([...ownVotes].map(([p, byQ]) => [p, new Map(byQ)]));
    for (const [key, sel] of optimistic) {
      const { pollId, q } = unCk(key);
      let byQ = merged.get(pollId);
      if (!byQ) { byQ = new Map(); merged.set(pollId, byQ); }
      byQ.set(q, sel);
    }
    return merged;
  }, [ownVotes, optimistic]);

  const displayVotes = useMemo<Votes>(() => {
    if (optimistic.size === 0) return votes;
    const merged = cloneVotes(votes);
    for (const [key, sel] of optimistic) {
      const { pollId, q } = unCk(key);
      const tally = ensureTally(merged, pollId, q);
      applyOptimisticVote(tally, confirmedOwn(pollId, q), sel, myUri);
    }
    return merged;
  }, [votes, optimistic, confirmedOwn, myUri]);

  const onVote = useCallback((pollId: string, q: number, optionIndex: number, action: 'added' | 'removed') => {
    const multi = pollsInFeed.get(pollId)?.[q]?.multiSelect === true;
    const key = ck(pollId, q);
    const current = optimistic.get(key) ?? confirmedOwn(pollId, q);
    const next = new Set(current);
    if (action === 'removed') next.delete(optionIndex);
    else if (multi) next.add(optionIndex);
    else { next.clear(); next.add(optionIndex); }
    setOptimistic(prev => { const m = new Map(prev); m.set(key, next); return m; });

    const undo = (): void => { setOptimistic(prev => { const m = new Map(prev); m.delete(key); return m; }); };
    if (!multi && action === 'added') {
      for (const prevIdx of current) {
        if (prevIdx !== optionIndex) {
          void xmtpVote(activeLine, pollId, prevIdx, 'removed', q)
            .catch((e: unknown) => { console.warn('xmtp vote-retract failed', e); });
        }
      }
    }
    void xmtpVote(activeLine, pollId, optionIndex, action, q)
      .catch((e: unknown) => { console.warn('xmtp vote failed', e); undo(); });
  }, [activeLine, pollsInFeed, optimistic, confirmedOwn]);

  return { displayVotes, displayOwnVotes, onVote };
}

function useOptimisticOpenAnswers(activeLine: string, openAnswers: OpenAnswers, myUri: string) {
  const [optimisticOpen, setOptimisticOpen] = useState<Map<string, { text: string; ts: string }>>(new Map());

  useEffect(() => {
    setOptimisticOpen(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [key, pending] of prev) {
        const { pollId, q } = unCk(key);
        const conf = openAnswers.get(pollId)?.get(q)?.get(myUri)?.text ?? '';
        if (conf === pending.text) { next.delete(key); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [openAnswers, myUri]);

  const displayOpenAnswers = useMemo<OpenAnswers>(() => {
    if (optimisticOpen.size === 0) return openAnswers;
    const merged: OpenAnswers = new Map(
      [...openAnswers].map(([p, byQ]) => [p, new Map([...byQ].map(([qi, m]) => [qi, new Map(m)]))]),
    );
    for (const [key, pending] of optimisticOpen) {
      const { pollId, q } = unCk(key);
      let byQ = merged.get(pollId);
      if (!byQ) { byQ = new Map(); merged.set(pollId, byQ); }
      let m = byQ.get(q);
      if (!m) { m = new Map(); byQ.set(q, m); }
      if (pending.text) m.set(myUri, pending);
      else m.delete(myUri);
    }
    return merged;
  }, [openAnswers, optimisticOpen, myUri]);

  const onOpenAnswer = useCallback((pollId: string, q: number, text: string) => {
    const key = ck(pollId, q);
    const trimmed = text.trim();
    setOptimisticOpen(prev => {
      const m = new Map(prev); m.set(key, { text: trimmed, ts: new Date().toISOString() }); return m;
    });
    const undo = (): void => { setOptimisticOpen(prev => { const m = new Map(prev); m.delete(key); return m; }); };
    void xmtpOpenAnswer(activeLine, pollId, q, trimmed)
      .catch((e: unknown) => { console.warn('xmtp open-answer failed', e); undo(); });
  }, [activeLine]);

  return { displayOpenAnswers, onOpenAnswer };
}

export function useVotesLayer(
  activeLine: string,
  events: HistoryEntry[],
  votes: Votes,
  ownVotes: Own,
  openAnswers: OpenAnswers,
  myUri: string,
) {
  const pollsInFeed = useMemo(() => pollQuestionsInFeed(events), [events]);

  const { displayVotes, displayOwnVotes, onVote } = useOptimisticVotes(
    activeLine, votes, ownVotes, pollsInFeed, myUri,
  );
  const { displayOpenAnswers, onOpenAnswer } = useOptimisticOpenAnswers(activeLine, openAnswers, myUri);

  return { displayVotes, displayOwnVotes, onVote, displayOpenAnswers, onOpenAnswer };
}
