/** The `useXmtpFeed` conversation-feed hook for the app's XMTP client lib.
 *  Extracted from lib/xmtp.ts (phase-2 lint split); re-exported from there.
 *
 *  `useXmtpFeed` no longer owns a stream or a poll — it subscribes to its conv's
 *  feedCache slice. The single app-wide stream + its backstops live in
 *  xmtp.stream.ts; the channels list keeps its own subscription via
 *  `subscribeAllMessages`, so this hook is scoped to the conversation-view feed
 *  only. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecodedMessage } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { isMetroControlBody } from './push';
import { useAccountEpoch } from './accountEpoch';
import { getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { feedCache, activeFeedLines } from './xmtp.state';
import { ensureGlobalStream, PAGE_SIZE } from './xmtp.stream';
import { type XmtpFeedStatus } from './xmtp.types';

/** Hook: load the existing message history for an XMTP conversation, then subscribe
 *  to its live stream. Returned `events` are in the same newest-first ordering the
 *  `useTail` SSE hook uses, so the inverted FlatList can render them unchanged.
 *
 *  Caller passes a metro line URI (`metro://xmtp/<convId>`). When `enabled` is
 *  false, the hook stays idle — callers use this to suppress loading until the
 *  client is built. */
export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
  loadOlder: () => Promise<void>; hasMore: boolean; loadingOlder: boolean;
} {
  /** Re-init the feed when the active account changes (in-place switch) — the
   *  cached client + feedCache have been swapped out under us, so re-run the
   *  effect against the new inbox without a hard reload. */
  const accountEpoch = useAccountEpoch();
  const [events, setEvents] = useState<HistoryEntry[]>(() => (line ? feedCache.get(line) ?? [] : []));
  const [status, setStatus] = useState<XmtpFeedStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string>('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** Latest events held in a ref so the stable `loadOlder` callback can read the
   *  current tail (oldest loaded event = pagination cursor) without re-creating
   *  itself on every render. */
  const eventsRef = useRef<HistoryEntry[]>(events);
  eventsRef.current = events;
  const loadingOlderRef = useRef(false);
  const hasMoreRef = useRef(true);
  hasMoreRef.current = hasMore;
  const lineRef = useRef(line);
  lineRef.current = line;

  useEffect(() => {
    if (!enabled || !line) { setStatus('idle'); return; }
    const ln = line;
    let cancelled = false;
    /** Seeded from cache → already 'open' (skip the spinner); otherwise show the
     *  loading spinner until the first refresh lands. */
    setStatus(feedCache.get(ln)?.length ? 'open' : 'loading');
    setError(null);
    setEvents(feedCache.get(ln) ?? []);
    /** Fresh conversation → reset older-page pagination so scroll-up can fetch
     *  history again from the new conv's tail. */
    setHasMore(true);
    setLoadingOlder(false);
    loadingOlderRef.current = false;

    /** Mark this conv as having a live viewer so the single global resync
     *  backstop keeps its slice fresh, and ensure the one app-wide message
     *  stream is running. No per-conv stream + no per-conv poll any more — the
     *  module-level `streamAllMessages` fan-out (see ensureGlobalStream) routes
     *  inbound messages straight into `feedCache`, which we subscribe to below. */
    activeFeedLines.add(ln);
    void ensureGlobalStream();

    /** Subscribe to this conv's feedCache slice. The global stream + the initial
     *  load + the resync backstop all write through `pushToFeedSlice`/`feedCache`,
     *  which fires this callback. Mirror the slice into local `events` state. */
    const unsubscribe = feedCache.subscribe(ln, (slice) => {
      if (cancelled || !slice) return;
      setEvents(slice);
    });

    /** Map decoded messages → envelopes and merge into the conv's feedCache slice
     *  (dedup by id, newest-first). Drops our private register-push control DMs —
     *  they ride plain text but must never render as chat bubbles. */
    const applyMessages = (msgs: DecodedMessage[]): void => {
      const prev = feedCache.get(ln) ?? [];
      const seen = new Set(prev.map(e => e.id));
      const additions = msgs.map(m => envelopeOfXmtpMessage(m, ln))
        .filter(e => !isMetroControlBody(e.text) && !seen.has(e.id));
      if (additions.length === 0) {
        /** Still surface the cached slice on the very first paint. */
        if (prev.length > 0) setEvents(prev);
        return;
      }
      /** `messages()` returns newest-first; merge new items into the same ordering. */
      feedCache.set(ln, [...additions, ...prev]);
    };

    /** Local-first open: paint whatever is already in the local MLS db
     *  IMMEDIATELY, before the network sync, then reconcile with the network. */
    const refresh = async (): Promise<void> => {
      try {
        const conv = await convOfLine(ln);
        if (!conv || cancelled) return;
        const local = await conv.messages({ limit: PAGE_SIZE });
        if (cancelled) return;
        applyMessages(local);
        await conv.sync().catch(() => undefined);
        if (cancelled) return;
        const synced = await conv.messages({ limit: PAGE_SIZE });
        if (cancelled) return;
        applyMessages(synced);
      } catch { /* swallow — global resync backstop will retry */ }
    };

    (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (cancelled) return;
        setInboxId(client.inboxId);
        await refresh();
        setStatus('open');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError((e as Error).message);
      }
    })();
    return (): void => {
      cancelled = true;
      unsubscribe();
      activeFeedLines.delete(ln);
    };
  }, [line, enabled, accountEpoch]);

  /** Fetch the next older page on scroll-up. Events are newest-first, so the LAST
   *  loaded event is the oldest; its `sentNs` is the cursor. The RN SDK's
   *  `Conversation.messages({ limit, beforeNs, direction })` (MessagesOptions,
   *  direction defaults to DESCENDING = newest-first) returns the `limit` messages
   *  sent strictly before `beforeNs`, still newest-first — so we APPEND them to the
   *  end of `events`, preserving the newest-first ordering the inverted list wants.
   *  Stable identity (deps are only refs) so the FlatList's onEndReached prop never
   *  churns. Never throws. */
  const loadOlder = useCallback(async (): Promise<void> => {
    const ln = lineRef.current;
    if (loadingOlderRef.current || !hasMoreRef.current || !ln) return;
    const oldest = eventsRef.current[eventsRef.current.length - 1];
    if (!oldest) return;
    /** `oldest.ts` is the ISO ms timestamp the envelope was built from `sentNs`;
     *  reconstruct the ns cursor (the SDK only loses sub-ms precision, which is
     *  fine for a strict before-cursor on distinct messages). */
    const beforeNs = new Date(oldest.ts).getTime() * 1_000_000;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const conv = await convOfLine(ln);
      if (!conv) return;
      const older = await conv.messages({
        limit: PAGE_SIZE,
        beforeNs,
        direction: 'DESCENDING',
      });
      const mapped = older
        .map(m => envelopeOfXmtpMessage(m, ln))
        .filter(e => !isMetroControlBody(e.text));
      /** Write older pages through feedCache (the single source of truth) so the
       *  slice subscription keeps them — append to the END to keep newest-first. */
      const prev = feedCache.get(ln) ?? eventsRef.current;
      const seen = new Set(prev.map(e => e.id));
      const additions = mapped.filter(e => !seen.has(e.id));
      if (additions.length > 0) feedCache.set(ln, [...prev, ...additions]);
      /** Fewer than a full page of NEW older messages came back → end of history. */
      const newCount = mapped.filter(e => !eventsRef.current.some(x => x.id === e.id)).length;
      if (newCount < PAGE_SIZE) { hasMoreRef.current = false; setHasMore(false); }
    } catch { /* best-effort — scroll-up will retry on the next onEndReached */ }
    finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  return { events, status, error, inboxId, loadOlder, hasMore, loadingOlder };
}
