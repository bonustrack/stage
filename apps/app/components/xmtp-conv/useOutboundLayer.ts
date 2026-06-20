/** @file Optimistic outbound + inverted-list scroll/jump layer for the XMTP conversation screen: owns optimistic send entries, their dedup against the live feed, jump-to-bottom / sticky-bottom remount, and the reply-jump highlight. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import { patchRowSent } from '../../modules/messaging';
import type { HistoryEntry } from '../../lib/types';
import type { FlatList } from 'react-native-gesture-handler';
import { hasAttachments, isReaction } from './feed-helpers';

/** Match optimistic entries to confirmed live twins by exact real id (from onSent) else a text-only echo in a 1s-slack/30s window, consuming each live message once and only at/after the send time so a quick duplicate send never latches an older bubble. */
function matchConfirmed(
  optimistic: HistoryEntry[], liveBubbles: HistoryEntry[],
  myUri: string, confirmedIds: Map<string, string>,
): Set<string> {
  const confirmed = new Set<string>();
  if (!optimistic.length) return confirmed;
  const used = new Set<string>(); /** live message ids already claimed */
  /** Oldest optimistic first so earlier sends claim earlier echoes. */
  const ordered = [...optimistic].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  for (const o of ordered) {
    const realId = confirmedIds.get(o.id);
    if (realId) {
      const byId = liveBubbles.find(e => e.id === realId && !used.has(e.id));
      if (byId) { used.add(byId.id); confirmed.add(o.id); continue; }
    }
    /** Attachment sends confirm ONLY by exact id (above) — never the text/ts heuristic. */
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

/** Drop confirmed optimistic entries + their id mappings once the live feed catches up. */
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

/** Sticky-bottom: remount the inverted list to land at offset 0 when a new bubble arrives at the bottom. */
function useStickyBottom(allBubblesLength: number, showJump: boolean, setShowJump: (v: boolean) => void, setListEpoch: React.Dispatch<React.SetStateAction<number>>): void {
  const prevBubbleCount = useRef(0);
  useEffect(() => {
    if (allBubblesLength > prevBubbleCount.current && prevBubbleCount.current > 0) {
      /** New message at the visual bottom — force-remount + clear the jump button (the inverted list can report a stale offset after a content shift). */
      if (!showJump) setListEpoch(e => e + 1);
      setShowJump(false);
    }
    prevBubbleCount.current = allBubblesLength;
  }, [allBubblesLength, showJump]);
}

/** Provides outbound feed state such as the jump-to-latest indicator. */
export function useOutboundLayer(
  events: HistoryEntry[],
  myUri: string,
  convId: string | undefined,
  activeLine: string,
) {
  const [showJump, setShowJump] = useState(false);
  /** Bump to force-remount the FlatList for jump-to-bottom, since every scroll API variant trips reanimated #3670 on Reduce-Motion devices; remount lands at the inverted list's default offset (bottom). */
  const [listEpoch, setListEpoch] = useState(0);
  /** Transient highlight on a message we jumped to (by tapping its quoted reply-preview). Cleared after a short flash. */
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const jumpClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<HistoryEntry>>(null);

  /** Optimistic outbound entries — rendered immediately on send, dropped once the composer resolves its send promise (XMTP self-sends don't always come back via streamMessages). */
  const [optimistic, setOptimistic] = useState<HistoryEntry[]>([]);
  /** localId → real XMTP message id (resolved when send() settles), used to confirm/drop an optimistic entry by EXACT id when it appears in the live feed; the text+timestamp heuristic stays as the fallback. */
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
  /** Jump to a quoted/replied-to message: best-effort scroll the inverted list to its row (try/catch + animated:false for reanimated #3670, with onScrollToIndexFailed for unrendered rows) and always flash a highlight so the user gets feedback even if the scroll can't land. */
  const jumpToMessage = useCallback((messageId: string) => {
    const idx = allBubbles.findIndex(b => b.id === messageId);
    setJumpHighlightId(messageId);
    if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current);
    jumpClearTimer.current = setTimeout(() => { setJumpHighlightId(null); }, 1800);
    if (idx < 0) return;
    try {
      listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
    } catch { /* reanimated #3670 / row not rendered — highlight is the feedback */ }
  }, [allBubbles]);
  useEffect(() => () => { if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current); }, []);

  /** Optimistic add of a freshly-sent outbound entry (driven by the composer). */
  const onOptimistic = useCallback(({ localId, text, attachments, replyTo, payload }: {
    localId: string; text: string;
    attachments: { mime?: string; name?: string }[];
    replyTo?: string; payload?: HistoryEntry['payload'];
  }) => {
    /** Inverted FlatList + `maintainVisibleContentPosition` + prepended optimistic entry = bubble appears at the visual bottom automatically. */
    setOptimistic(prev => [{
      id: localId, ts: new Date().toISOString(),
      station: 'xmtp', line: activeLine,
      from: myUri, to: activeLine,
      text: text || undefined,
      ...(replyTo ? { replyTo } : {}),
      ...(payload ? { payload } : attachments.length ? { payload: { attachments } } : {}),
    }, ...prev]);
    /** Always remount so the user lands on their own bubble — `maintainVisibleContentPosition` anchors the previously-visible content and the new entry falls below the viewport. */
    setListEpoch(e => e + 1);
    setShowJump(false);
    /** Patch the channels-list cache now so the just-sent message shows as the latest preview on back — XMTP self-sends don't reliably replay through streamAllMessages, so the list would otherwise lag until the next poll/resume. */
    const preview = text.trim() || attachmentEmojiPreview(attachments[0]?.mime, attachments[0]?.name);
    if (convId) patchRowSent(convId, preview);
  }, [activeLine, myUri, convId]);

  const onSent = useCallback((localId: string, _error: unknown, sentId?: string) => {
    /** Thread the real XMTP id back so the dedup memo confirms this optimistic entry by EXACT id from the live feed; don't drop it here (that made the bubble vanish for a frame) — the dedup effect drops it once the live twin lands; on a send error (no id) drop the stranded bubble. */
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
