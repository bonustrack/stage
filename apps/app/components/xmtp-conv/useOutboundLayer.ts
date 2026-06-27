
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import { patchRowSent } from '../../modules/messaging';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { FlatList } from 'react-native-gesture-handler';
import { hasAttachments, isReaction } from './feed-helpers';

function matchConfirmed(
  optimistic: HistoryEntry[], liveBubbles: HistoryEntry[],
  myUri: string, confirmedIds: Map<string, string>,
): Set<string> {
  const confirmed = new Set<string>();
  if (!optimistic.length) return confirmed;
  const used = new Set<string>();
  const ordered = [...optimistic].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  for (const o of ordered) {
    const realId = confirmedIds.get(o.id);
    if (realId) {
      const byId = liveBubbles.find(e => e.id === realId && !used.has(e.id));
      if (byId) { used.add(byId.id); confirmed.add(o.id); continue; }
    }
    if (hasAttachments(o)) continue;
    const oTs = new Date(o.ts).getTime();
    const match = liveBubbles.find(e =>
      e.from === myUri && !used.has(e.id)
      && new Date(e.ts).getTime() >= oTs - 1_000
      && new Date(e.ts).getTime() - oTs < 30_000
      && e.text === o.text);
    if (match) { used.add(match.id); confirmed.add(o.id); }
  }
  return confirmed;
}

function useOptimisticCleanup(
  optimistic: HistoryEntry[], confirmedOptimisticIds: Set<string>,
  setOptimistic: React.Dispatch<React.SetStateAction<HistoryEntry[]>>,
  setConfirmedIds: React.Dispatch<React.SetStateAction<Map<string, string>>>,
): void {
  useEffect(() => {
    if (!optimistic.length) return;
    const live = optimistic.filter(o => !confirmedOptimisticIds.has(o.id));
    if (live.length === optimistic.length) return;
    setOptimistic(live);
    setConfirmedIds(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const o of optimistic) {
        if (confirmedOptimisticIds.has(o.id) && next.delete(o.id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [optimistic, confirmedOptimisticIds]);
}

function useStickyBottom(allBubblesLength: number, showJump: boolean, setShowJump: (v: boolean) => void, setListEpoch: React.Dispatch<React.SetStateAction<number>>): void {
  const prevBubbleCount = useRef(0);
  useEffect(() => {
    if (allBubblesLength > prevBubbleCount.current && prevBubbleCount.current > 0) {
      if (!showJump) setListEpoch(e => e + 1);
      setShowJump(false);
    }
    prevBubbleCount.current = allBubblesLength;
  }, [allBubblesLength, showJump]);
}

export function useOutboundLayer(
  events: HistoryEntry[],
  myUri: string,
  convId: string | undefined,
  activeLine: string,
) {
  const [showJump, setShowJump] = useState(false);
  const [listEpoch, setListEpoch] = useState(0);
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const jumpClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<HistoryEntry>>(null);

  const [optimistic, setOptimistic] = useState<HistoryEntry[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Map<string, string>>(new Map());

  const liveBubbles = useMemo(() => events.filter(e => !isReaction(e)), [events]);
  const confirmedOptimisticIds = useMemo(
    () => matchConfirmed(optimistic, liveBubbles, myUri, confirmedIds),
    [liveBubbles, optimistic, myUri, confirmedIds],
  );
  const allBubbles = useMemo(() => {
    if (!optimistic.length) return liveBubbles;
    return [...optimistic.filter(o => !confirmedOptimisticIds.has(o.id)), ...liveBubbles];
  }, [liveBubbles, optimistic, confirmedOptimisticIds]);
  useOptimisticCleanup(optimistic, confirmedOptimisticIds, setOptimistic, setConfirmedIds);
  useStickyBottom(allBubbles.length, showJump, setShowJump, setListEpoch);
  const jumpToMessage = useCallback((messageId: string) => {
    const idx = allBubbles.findIndex(b => b.id === messageId);
    setJumpHighlightId(messageId);
    if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current);
    jumpClearTimer.current = setTimeout(() => { setJumpHighlightId(null); }, 1800);
    if (idx < 0) return;
    try {
      listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
    } catch { }
  }, [allBubbles]);
  useEffect(() => () => { if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current); }, []);

  const onOptimistic = useCallback(({ localId, text, attachments, replyTo, payload }: {
    localId: string; text: string;
    attachments: { mime?: string; name?: string }[];
    replyTo?: string; payload?: HistoryEntry['payload'];
  }) => {
    setOptimistic(prev => [{
      id: localId, ts: new Date().toISOString(),
      station: 'xmtp', line: activeLine,
      from: myUri, to: activeLine,
      text: text || undefined,
      ...(replyTo ? { replyTo } : {}),
      ...(payload ? { payload } : attachments.length ? { payload: { attachments } } : {}),
    }, ...prev]);
    setListEpoch(e => e + 1);
    setShowJump(false);
    const preview = text.trim() || attachmentEmojiPreview(attachments[0]?.mime, attachments[0]?.name);
    if (convId) patchRowSent(convId, preview);
  }, [activeLine, myUri, convId]);

  const onSent = useCallback((localId: string, _error: unknown, sentId?: string) => {
    if (sentId) {
      setConfirmedIds(prev => {
        const next = new Map(prev);
        next.set(localId, sentId);
        return next;
      });
    } else {
      setOptimistic(prev => prev.filter(o => o.id !== localId));
    }
  }, []);

  return {
    showJump, setShowJump, listEpoch, setListEpoch, jumpHighlightId,
    listRef, confirmedIds, allBubbles, jumpToMessage, onOptimistic, onSent,
  };
}
