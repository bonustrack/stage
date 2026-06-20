/** @file Optimistic reaction / un-react layer for the XMTP conversation screen — extracted from app/xmtp/[convId].tsx verbatim (phase-2 lint split). */

import { useCallback, useEffect, useState } from 'react';
import { xmtpReact } from '../../modules/messaging';

/** Provides reaction state and the handler for sending reactions on a conversation. */
export function useReactionsLayer(
  activeLine: string,
  reactions: Map<string, Map<string, number>>,
  ownReactions: Map<string, Set<string>>,
) {
  /** Optimistic reactions: messageId → emoji[] the local user just tapped, shown semi-transparent until the live XMTP stream echoes the reaction back (or the send fails). Dropped per-pair in the dedup effect below + on send rejection. */
  const [optimisticReactions, setOptimisticReactions] = useState<Map<string, string[]>>(new Map());
  /** Optimistic un-reacts: messageId → emoji[] just removed; hides the confirmed pill immediately until the live stream echoes the `removed` event, at which point `reactions` no longer carries it and we drop it from this map. */
  const [optimisticRemovals, setOptimisticRemovals] = useState<Map<string, string[]>>(new Map());

  /** Once the live stream confirms an optimistic reaction (emoji now present in `reactions` for that message), drop it from the pending map so the pill flips from semi-transparent to the solid confirmed pill. */
  useEffect(() => {
    setOptimisticReactions(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map<string, string[]>();
      for (const [msgId, emojis] of prev) {
        const confirmed = reactions.get(msgId);
        const left = emojis.filter(e => !confirmed?.has(e));
        if (left.length !== emojis.length) changed = true;
        if (left.length) next.set(msgId, left);
      }
      return changed ? next : prev;
    });
    /** Symmetric drop for pending un-reacts: once the live feed no longer carries the emoji on that message, the removal has confirmed — forget it. */
    setOptimisticRemovals(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map<string, string[]>();
      for (const [msgId, emojis] of prev) {
        const confirmed = reactions.get(msgId);
        const left = emojis.filter(e => confirmed?.has(e));
        if (left.length !== emojis.length) changed = true;
        if (left.length) next.set(msgId, left);
      }
      return changed ? next : prev;
    });
  }, [reactions]);

  const onReact = useCallback((messageId: string, emoji: string) => {
    /** Toggle: if the user already owns this emoji on this message (confirmed in the live feed, and not already optimistically removed), re-selecting / tapping the pill sends `removed`; otherwise `added`. */
    const alreadyOwned = !!ownReactions.get(messageId)?.has(emoji)
      && !(optimisticRemovals.get(messageId)?.includes(emoji));
    const action: 'added' | 'removed' = alreadyOwned ? 'removed' : 'added';

    if (action === 'removed') {
      /** Optimistic un-react: hide the pill immediately. */
      setOptimisticRemovals(prev => {
        const cur = prev.get(messageId) ?? [];
        if (cur.includes(emoji)) return prev;
        const next = new Map(prev);
        next.set(messageId, [...cur, emoji]);
        return next;
      });
      /** Also clear any not-yet-confirmed optimistic add for the same pair. */
      setOptimisticReactions(prev => {
        const cur = prev.get(messageId);
        if (!cur?.includes(emoji)) return prev;
        const left = cur.filter(e => e !== emoji);
        const next = new Map(prev);
        if (left.length) next.set(messageId, left); else next.delete(messageId);
        return next;
      });
      /** Undo helper. */
      const undo = (): void => { setOptimisticRemovals(prev => {
        const cur = prev.get(messageId);
        if (!cur) return prev;
        const left = cur.filter(e => e !== emoji);
        const next = new Map(prev);
        if (left.length) next.set(messageId, left); else next.delete(messageId);
        return next;
      }); };
      void xmtpReact(activeLine, messageId, emoji, 'removed')
        .catch((e: unknown) => { console.warn('xmtp un-react failed', e); undo(); });
      return;
    }

    /** Optimistic reaction: drop the pill in immediately (semi-transparent) before the XMTP send resolves, then let the live stream solidify it. Dedup by messageId+emoji so re-tapping the same emoji doesn't stack duplicates. */
    setOptimisticReactions(prev => {
      const cur = prev.get(messageId) ?? [];
      if (cur.includes(emoji)) return prev;
      const next = new Map(prev);
      next.set(messageId, [...cur, emoji]);
      return next;
    });
    /** Drop Pending. */
    const dropPending = (): void => { setOptimisticReactions(prev => {
      const cur = prev.get(messageId);
      if (!cur) return prev;
      const left = cur.filter(e => e !== emoji);
      const next = new Map(prev);
      if (left.length) next.set(messageId, left); else next.delete(messageId);
      return next;
    }); };
    void xmtpReact(activeLine, messageId, emoji, 'added')
      .catch((e: unknown) => { console.warn('xmtp react failed', e); dropPending(); });
  }, [activeLine, ownReactions, optimisticRemovals]);

  return { optimisticReactions, optimisticRemovals, onReact };
}
