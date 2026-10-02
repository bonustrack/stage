import { useEffect, useState } from 'react';
import { xmtpReact } from '../../lib/xmtp.messages';
import { useStableCallback } from '../../lib/useStableCallback';
import { ownsReaction } from '../bubble/reactions.model';

type Pending = Map<string, string[]>;

function withEmoji(prev: Pending, messageId: string, emoji: string): Pending {
  const cur = prev.get(messageId) ?? [];
  if (cur.includes(emoji)) return prev;
  return new Map(prev).set(messageId, [...cur, emoji]);
}

function withoutEmoji(prev: Pending, messageId: string, emoji: string): Pending {
  const cur = prev.get(messageId);
  if (!cur?.includes(emoji)) return prev;
  const left = cur.filter(e => e !== emoji);
  const next = new Map(prev);
  if (left.length) next.set(messageId, left); else next.delete(messageId);
  return next;
}

function settle(prev: Pending, keep: (msgId: string, emoji: string) => boolean): Pending {
  if (prev.size === 0) return prev;
  let changed = false;
  const next: Pending = new Map();
  for (const [msgId, emojis] of prev) {
    const left = emojis.filter(e => keep(msgId, e));
    if (left.length !== emojis.length) changed = true;
    if (left.length) next.set(msgId, left.length === emojis.length ? emojis : left);
  }
  return changed ? next : prev;
}

export function useReactionsLayer(activeLine: string, ownReactions: Map<string, Set<string>>) {
  const [optimisticReactions, setOptimisticReactions] = useState<Pending>(new Map());
  const [optimisticRemovals, setOptimisticRemovals] = useState<Pending>(new Map());

  useEffect(() => {
    setOptimisticReactions(prev => settle(prev, (msgId, e) => !ownReactions.get(msgId)?.has(e)));
    setOptimisticRemovals(prev => settle(prev, (msgId, e) => !!ownReactions.get(msgId)?.has(e)));
  }, [ownReactions]);

  const onReact = useStableCallback((messageId: string, emoji: string) => {
    const removing = ownsReaction(
      !!ownReactions.get(messageId)?.has(emoji),
      !!optimisticReactions.get(messageId)?.includes(emoji),
      !!optimisticRemovals.get(messageId)?.includes(emoji),
    );
    const [setPending, setOpposite] = removing
      ? [setOptimisticRemovals, setOptimisticReactions]
      : [setOptimisticReactions, setOptimisticRemovals];
    setPending(prev => withEmoji(prev, messageId, emoji));
    setOpposite(prev => withoutEmoji(prev, messageId, emoji));
    void xmtpReact(activeLine, messageId, emoji, removing ? 'removed' : 'added')
      .catch((e: unknown) => {
        console.warn('xmtp react failed', e);
        setPending(prev => withoutEmoji(prev, messageId, emoji));
      });
  });

  return { optimisticReactions, optimisticRemovals, onReact };
}
