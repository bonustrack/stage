/** Optimistic outbound + inverted-list scroll/jump layer for the XMTP conversation
 *  screen — extracted from app/xmtp/[convId].tsx verbatim (phase-2 lint split).
 *  Owns the optimistic send entries, their dedup against the live feed, the
 *  jump-to-bottom / sticky-bottom remount logic, and the reply-jump highlight. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import { patchRowSent } from '../../modules/messaging';
import type { HistoryEntry } from '../../lib/types';
import type { FlatList } from 'react-native-gesture-handler';
import { hasAttachments, isReaction } from './feed-helpers';

/** Provides outbound feed state such as the jump-to-latest indicator. */
export function useOutboundLayer(
  events: HistoryEntry[],
  myUri: string,
  convId: string | undefined,
  activeLine: string,
) {
  const [showJump, setShowJump] = useState(false);
  /** Bump to force-remount the FlatList. Used by jump-to-bottom because every variant of
   *  the scroll API (`scrollToOffset`, `scrollToIndex`, `getScrollResponder`,
   *  `getNativeScrollRef`) trips reanimated #3670 "property is not writable" on devices
   *  with Reduce Motion. Remount lands at the inverted list's default offset = bottom. */
  const [listEpoch, setListEpoch] = useState(0);
  /** Transient highlight on a message we jumped to (by tapping its quoted
   *  reply-preview). Cleared after a short flash. */
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const jumpClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<HistoryEntry>>(null);

  /** Optimistic outbound entries — rendered immediately on send, dropped once the composer
   *  resolves its send promise (XMTP self-sends don't always come back via streamMessages). */
  const [optimistic, setOptimistic] = useState<HistoryEntry[]>([]);
  /** localId → real XMTP message id, resolved when the composer's send() promise
   *  settles (conv.send returns the id). Lets us confirm/drop an optimistic entry
   *  by EXACT id when that id appears in the live feed — zero false-confirm vs the
   *  text+timestamp heuristic, which stays as a fallback for sends that resolve
   *  without an id (or before the map updates). */
  const [confirmedIds, setConfirmedIds] = useState<Map<string, string>>(new Map());

  const liveBubbles = useMemo(
    () => events.filter(e => !isReaction(e)),
    [events],
  );
  /** Match optimistic entries to their confirmed live twins.
   *
   *  THE RACE (root cause of the "sent message doesn't show until the stream
   *  confirms it" bug): the old check was `liveBubbles.some(e => same text
   *  within 30s)`. If you'd sent the SAME text in the last 30s, a brand-new
   *  optimistic entry instantly matched that OLD live bubble and got filtered
   *  out of `allBubbles` on the very first render — so it vanished until its
   *  own stream echo arrived seconds later. Duplicate/similar quick sends hit
   *  this every time; that's the intermittency.
   *
   *  Fix: only confirm against live messages that landed AT/AFTER the optimistic
   *  entry's own send time, and consume each live message at most once so two
   *  optimistic entries can't both latch onto a single (possibly older) bubble.
   *  Returns the set of optimistic ids that are now confirmed. */
  const confirmedOptimisticIds = useMemo(() => {
    const confirmed = new Set<string>();
    if (!optimistic.length) return confirmed;
    const used = new Set<string>(); // live message ids already claimed
    /** Oldest optimistic first so earlier sends claim earlier echoes. */
    const ordered = [...optimistic].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
    );
    for (const o of ordered) {
      /** Exact-id confirm: once we know the real id (from onSent) and it's in the
       *  live feed, confirm by id — no false positives, instant + stable. */
      const realId = confirmedIds.get(o.id);
      if (realId) {
        const byId = liveBubbles.find(e => e.id === realId && !used.has(e.id));
        if (byId) { used.add(byId.id); confirmed.add(o.id); continue; }
      }
      /** STRUCTURAL no-gap rule: confirm attachment sends ONLY by exact real id
       *  (above), never the text/ts heuristic — that'd drop the optimistic local
       *  thumbnail before `conv.send()` primes the id + cache → blank-gap echo. */
      if (hasAttachments(o)) continue;
      const oTs = new Date(o.ts).getTime();
      /** Text-only echo: match within a 1s-slack / 30s window so a new send never latches an older bubble. */
      const match = liveBubbles.find(e =>
        e.from === myUri
        && !used.has(e.id)
        && new Date(e.ts).getTime() >= oTs - 1_000
        && new Date(e.ts).getTime() - oTs < 30_000
        && e.text === o.text);
      if (match) { used.add(match.id); confirmed.add(o.id); }
    }
    return confirmed;
  }, [liveBubbles, optimistic, myUri, confirmedIds]);
  const allBubbles = useMemo(() => {
    if (!optimistic.length) return liveBubbles;
    return [...optimistic.filter(o => !confirmedOptimisticIds.has(o.id)), ...liveBubbles];
  }, [liveBubbles, optimistic, confirmedOptimisticIds]);
  /** Once the live feed has caught up, drop the now-dead optimistic entries from state. */
  useEffect(() => {
    if (!optimistic.length) return;
    const live = optimistic.filter(o => !confirmedOptimisticIds.has(o.id));
    if (live.length !== optimistic.length) {
      setOptimistic(live);
      /** Forget any id mappings for the dropped entries so the map can't grow unbounded. */
      setConfirmedIds(prev => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Map(prev);
        for (const o of optimistic) {
          if (confirmedOptimisticIds.has(o.id) && next.delete(o.id)) changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [optimistic, confirmedOptimisticIds]);
  /** Sticky-bottom for inbound messages: when a new entry arrives and the user is
   *  already at the visual bottom (`showJump=false` means scroll offset ≤ 12px),
   *  remount the list so it lands at offset 0 again. Skip on initial mount. */
  const prevBubbleCount = useRef(0);
  useEffect(() => {
    if (allBubbles.length > prevBubbleCount.current && prevBubbleCount.current > 0) {
      /** New message arrived while we were at the visual bottom — keep us pinned
       *  by force-remounting + clearing the jump-button. Without the explicit
       *  setShowJump(false) the inverted list sometimes reports a stale large
       *  offset after maintainVisibleContentPosition shifts content, leaving
       *  the button visible despite the user being at offset 0. */
      if (!showJump) {
        setListEpoch(e => e + 1);
      }
      setShowJump(false);
    }
    prevBubbleCount.current = allBubbles.length;
  }, [allBubbles.length, showJump]);
  /** Jump to the original of a quoted/replied-to message: scroll the inverted
   *  list to its row + flash a highlight. The scroll is best-effort — wrapped in
   *  try/catch with `animated:false` (reanimated #3670 makes the animated path
   *  throw on Reduce-Motion devices) and backed by the list's
   *  `onScrollToIndexFailed` no-op for not-yet-rendered rows. The highlight
   *  always fires so the user gets feedback even when the scroll can't land. */
  const jumpToMessage = useCallback((messageId: string) => {
    const idx = allBubbles.findIndex(b => b.id === messageId);
    setJumpHighlightId(messageId);
    if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current);
    jumpClearTimer.current = setTimeout(() => setJumpHighlightId(null), 1800);
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
    /** Inverted FlatList + `maintainVisibleContentPosition` + prepended optimistic
     *  entry = bubble appears at the visual bottom automatically. */
    setOptimistic(prev => [{
      id: localId, ts: new Date().toISOString(),
      station: 'xmtp', line: activeLine,
      from: myUri, to: activeLine,
      text: text || undefined,
      ...(replyTo ? { replyTo } : {}),
      ...(payload ? { payload } : attachments.length ? { payload: { attachments } } : {}),
    } as HistoryEntry, ...prev]);
    /** Always remount so the user lands on their own bubble — `maintainVisibleContentPosition`
     *  anchors the previously-visible content and the new entry falls below the viewport. */
    setListEpoch(e => e + 1);
    setShowJump(false);
    /** Patch the channels-list cache right away so the just-sent message
     *  shows as the latest preview when the user goes back — XMTP
     *  self-sends don't reliably replay through `streamAllMessages`, so
     *  the list would otherwise lag until the next 30s poll / app resume. */
    const preview = text.trim() || attachmentEmojiPreview(attachments[0]?.mime, attachments[0]?.name);
    if (convId) patchRowSent(convId, preview);
  }, [activeLine, myUri, convId]);

  const onSent = useCallback((localId: string, _error: unknown, sentId?: string) => {
    /** conv.send() resolves with the real XMTP message id — thread it back so
     *  the dedup memo confirms this optimistic entry by EXACT id when it shows
     *  up in the live feed (no text+timestamp guessing). We DON'T drop the
     *  optimistic entry here anymore: dropping it before the live echo arrives
     *  made the just-sent bubble vanish for a frame. The dedup effect drops it
     *  once the matching live bubble lands (by id, else the ts fallback). On a
     *  send error (no id) keep the old behavior: drop the stranded bubble. */
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
