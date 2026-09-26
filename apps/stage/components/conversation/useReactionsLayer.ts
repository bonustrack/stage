import { useEffect, useState } from 'react';
import { xmtpReact } from '../../modules/messaging';
import { useStableCallback } from '../../lib/useStableCallback';

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

export function useReactionsLayer(
  activeLine: string,
  reactions: Map<string, Map<string, string[]>>,
  ownReactions: Map<string, Set<string>>,
) {
  const [optimisticReactions, setOptimisticReactions] = useState<Pending>(new Map());
  const [optimisticRemovals, setOptimisticRemovals] = useState<Pending>(new Map());

  useEffect(() => {
    setOptimisticReactions(prev => settle(prev, (msgId, e) => !reactions.get(msgId)?.has(e)));
    setOptimisticRemovals(prev => settle(prev, (msgId, e) => !!reactions.get(msgId)?.has(e)));
  }, [reactions]);

  const onReact = useStableCallback((messageId: string, emoji: string) => {
    const alreadyOwned = !!ownReactions.get(messageId)?.has(emoji)
      && !(optimisticRemovals.get(messageId)?.includes(emoji));
    const [setPending, setOpposite] = alreadyOwned
      ? [setOptimisticRemovals, setOptimisticReactions]
      : [setOptimisticReactions, setOptimisticRemovals];
    setPending(prev => withEmoji(prev, messageId, emoji));
    if (alreadyOwned) setOpposite(prev => withoutEmoji(prev, messageId, emoji));
    void xmtpReact(activeLine, messageId, emoji, alreadyOwned ? 'removed' : 'added')
      .catch((e: unknown) => {
        console.warn('xmtp react failed', e);
        setPending(prev => withoutEmoji(prev, messageId, emoji));
      });
  });

  return { optimisticReactions, optimisticRemovals, onReact };
}
