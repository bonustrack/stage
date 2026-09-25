
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import { patchRowSent } from '../../modules/messaging';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { VirtualListHandle } from '../layout';
import { isReaction } from './feed-helpers';
import { localIdsByLiveId, matchConfirmed, mergeConfirmed } from './outboundRows.model';
import { useStableCallback } from '../../lib/useStableCallback';
import { attempt } from '../../lib/errorPolicy';

function useOptimisticCleanup(
  optimistic: HistoryEntry[], confirmed: Map<string, string>,
  setOptimistic: React.Dispatch<React.SetStateAction<HistoryEntry[]>>,
  setConfirmedIds: React.Dispatch<React.SetStateAction<Map<string, string>>>,
): void {
  useEffect(() => {
    if (!optimistic.length) return;
    const live = optimistic.filter(o => !confirmed.has(o.id));
    if (live.length === optimistic.length) return;
    setOptimistic(live);
    setConfirmedIds(prev => mergeConfirmed(prev, confirmed));
  }, [optimistic, confirmed]);
}

function useStickyBottom(
  allBubblesLength: number, convId: string | undefined, atBottom: () => boolean,
  setShowJump: (v: boolean) => void, scrollToNewest: () => void,
): void {
  const prevBubbleCount = useRef(0);
  useEffect(() => { prevBubbleCount.current = 0; }, [convId]);
  useEffect(() => {
    if (allBubblesLength > prevBubbleCount.current && prevBubbleCount.current > 0 && atBottom()) {
      scrollToNewest();
      setShowJump(false);
    }
    prevBubbleCount.current = allBubblesLength;
  }, [allBubblesLength, atBottom]);
}

export function useOutboundLayer(
  events: HistoryEntry[],
  myUri: string,
  convId: string | undefined,
  activeLine: string,
  atBottom: () => boolean,
) {
  const [showJump, setShowJump] = useState(false);
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const jumpClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<VirtualListHandle>(null);
  const scrollToNewest = useStableCallback(() => {
    requestAnimationFrame(() => {
      attempt(() => {
        if (Platform.OS === 'web') listRef.current?.scrollToEnd({ animated: false });
        else listRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 'ui');
    });
  });

  const [optimistic, setOptimistic] = useState<HistoryEntry[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Map<string, string>>(new Map());

  const liveBubbles = useMemo(() => events.filter(e => !isReaction(e)), [events]);
  const confirmed = useMemo(
    () => matchConfirmed(optimistic, liveBubbles, myUri, confirmedIds),
    [liveBubbles, optimistic, myUri, confirmedIds],
  );
  const allBubbles = useMemo(() => {
    if (!optimistic.length) return liveBubbles;
    return [...optimistic.filter(o => !confirmed.has(o.id)), ...liveBubbles];
  }, [liveBubbles, optimistic, confirmed]);
  useOptimisticCleanup(optimistic, confirmed, setOptimistic, setConfirmedIds);
  const localIdOf = useMemo(() => localIdsByLiveId(confirmedIds, confirmed), [confirmedIds, confirmed]);
  const rowKeyOf = useCallback((e: HistoryEntry): string => localIdOf.get(e.id) ?? e.id, [localIdOf]);
  useStickyBottom(allBubbles.length, convId, atBottom, setShowJump, scrollToNewest);
  const jumpToMessage = useStableCallback((messageId: string) => {
    const idx = allBubbles.findIndex(b => b.id === messageId);
    setJumpHighlightId(messageId);
    if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current);
    jumpClearTimer.current = setTimeout(() => { setJumpHighlightId(null); }, 1800);
    if (idx < 0) return;
    const index = Platform.OS === 'web' ? allBubbles.length - 1 - idx : idx;
    attempt(() => { listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 }); }, 'ui');
  });
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
    scrollToNewest();
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
    showJump, setShowJump, scrollToNewest, jumpHighlightId,
    listRef, confirmedIds, allBubbles, rowKeyOf, jumpToMessage, onOptimistic, onSent,
  };
}
