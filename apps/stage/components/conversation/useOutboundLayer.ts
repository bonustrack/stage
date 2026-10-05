
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { patchRowSent } from '../../lib/channelsCache';
import type { HistoryEntry } from '@stage-labs/client/types';
import { isDeleteRequest, type DeletedMessages } from '@stage-labs/client/xmtp/deletions';
import type { VirtualListHandle } from '../layout';
import { isReaction } from './feed-helpers';
import { isCallSignalEntry } from '@stage-labs/client/xmtp/call';
import { deletedViewCache } from './messageDeletion.model';
import { isLeftOnlyUpdate } from './systemNames.model';
import {
  optimisticRowPreview, outboundView, pendingFromMe, recordSent, settleOutbound, type OutboundState,
} from './outboundRows.model';
import { useStableCallback } from '../../lib/useStableCallback';
import { attempt } from '../../lib/errorPolicy';
import { useUploadedAttachments } from '../../lib/localAttachmentCache';

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
  isAtBottomRef: React.MutableRefObject<boolean>,
  deletedIds: DeletedMessages,
) {
  const atBottom = useCallback(() => isAtBottomRef.current, [isAtBottomRef]);
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

  const [outbound, setOutbound] = useState<OutboundState>(() => ({ optimistic: [], confirmedIds: new Map() }));

  const deletedView = useMemo(deletedViewCache, []);
  const liveBubbles = useMemo(
    () => events
      .filter(e => !isReaction(e) && !isLeftOnlyUpdate(e) && !isDeleteRequest(e) && !isCallSignalEntry(e))
      .map((e) => {
        const by = deletedIds.get(e.id);
        return by ? deletedView(e, by) : e;
      }),
    [events, deletedIds, deletedView],
  );
  const uploaded = useUploadedAttachments();
  const view = useMemo(() => outboundView(outbound, liveBubbles, myUri, uploaded), [outbound, liveBubbles, myUri, uploaded]);
  const allBubbles = useMemo(
    () => (view.pending.length ? [...pendingFromMe(view.pending, myUri), ...liveBubbles] : liveBubbles),
    [view, liveBubbles, myUri],
  );
  useEffect(() => {
    if (view.confirmed.size) setOutbound(s => settleOutbound(s, outboundView(s, liveBubbles, myUri, uploaded)));
  }, [view, liveBubbles, myUri, uploaded]);
  const { localIdOf } = view;
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
    setOutbound(s => ({ ...s, optimistic: [{
      id: localId, ts: new Date().toISOString(),
      station: 'xmtp', line: activeLine,
      from: myUri, to: activeLine,
      text: text || undefined,
      ...(replyTo ? { replyTo } : {}),
      ...(payload ? { payload } : attachments.length ? { payload: { attachments } } : {}),
    }, ...s.optimistic] }));
    isAtBottomRef.current = true;
    scrollToNewest();
    setShowJump(false);
    if (convId) patchRowSent(convId, optimisticRowPreview(text, attachments));
  }, [activeLine, myUri, convId, isAtBottomRef]);

  const onSent = useCallback((localId: string, _error: unknown, sentId?: string) => {
    setOutbound(s => recordSent(s, localId, sentId));
  }, []);

  return {
    showJump, setShowJump, scrollToNewest, jumpHighlightId,
    listRef, confirmedIds: outbound.confirmedIds, allBubbles, rowKeyOf, jumpToMessage, onOptimistic, onSent,
  };
}
