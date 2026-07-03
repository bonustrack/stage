
import { useCallback, useEffect, useState } from 'react';
import { xmtpReact } from '../../modules/messaging';

export function useReactionsLayer(
  activeLine: string,
  reactions: Map<string, Map<string, number>>,
  ownReactions: Map<string, Set<string>>,
) {
  const [optimisticReactions, setOptimisticReactions] = useState<Map<string, string[]>>(new Map());
  const [optimisticRemovals, setOptimisticRemovals] = useState<Map<string, string[]>>(new Map());

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
    const alreadyOwned = !!ownReactions.get(messageId)?.has(emoji)
      && !(optimisticRemovals.get(messageId)?.includes(emoji));
    const action: 'added' | 'removed' = alreadyOwned ? 'removed' : 'added';

    if (action === 'removed') {
      setOptimisticRemovals(prev => {
        const cur = prev.get(messageId) ?? [];
        if (cur.includes(emoji)) return prev;
        const next = new Map(prev);
        next.set(messageId, [...cur, emoji]);
        return next;
      });
      setOptimisticReactions(prev => {
        const cur = prev.get(messageId);
        if (!cur?.includes(emoji)) return prev;
        const left = cur.filter(e => e !== emoji);
        const next = new Map(prev);
        if (left.length) next.set(messageId, left); else next.delete(messageId);
        return next;
      });
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

    setOptimisticReactions(prev => {
      const cur = prev.get(messageId) ?? [];
      if (cur.includes(emoji)) return prev;
      const next = new Map(prev);
      next.set(messageId, [...cur, emoji]);
      return next;
    });
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
