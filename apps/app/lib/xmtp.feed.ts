/** The `useXmtpFeed` conversation-feed hook for the app's XMTP client lib.
 *  Subscribes to its conv's feedCache slice (the single app-wide stream + its
 *  backstops live in xmtp.stream.ts) and mirrors it into a TanStack-Query key
 *  (stage 2) so feed reads flow through the shared cache. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecodedMessage } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { isMetroControlBody } from './push';
import { useAccountEpoch } from './accountEpoch';
import { getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { feedCache, activeFeedLines } from './xmtp.state';
import { ensureGlobalStream, syncInboxOnce, PAGE_SIZE } from './xmtp.stream';
import { type XmtpFeedStatus, convIdOfLine } from './xmtp.types';
import { useFeedQuery, mirrorFeedSlice } from '../modules/messaging/feedQuery';

/** Hook: load the existing message history for an XMTP conversation, then subscribe
 *  to its live stream. Returned `events` are in the same newest-first ordering the
 *  `useTail` SSE hook uses, so the inverted FlatList can render them unchanged.
 *
 *  Caller passes a metro line URI (`metro://xmtp/<convId>`). When `enabled` is
 *  false, the hook stays idle (suppress loading until the client is built). */
export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
  loadOlder: () => Promise<void>; hasMore: boolean; loadingOlder: boolean;
} {
  /** Re-init the feed when the active account changes (in-place switch): the
   *  cached client + feedCache were swapped out, so re-run against the new
   *  inbox without a hard reload. */
  const accountEpoch = useAccountEpoch();
  /** convId for the feed query key (stage 2 Query mirror of the feedCache slice). */
  const convId = line ? convIdOfLine(line) : undefined;
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
    const cid = convIdOfLine(ln); // local copy so the effect deps stay [line,...]
    let cancelled = false;
    /** Seeded from cache → already 'open' (skip the spinner); otherwise show the
     *  loading spinner until the first refresh lands. */
    setStatus(feedCache.get(ln)?.length ? 'open' : 'loading');
    setError(null);
    setEvents(feedCache.get(ln) ?? []);
    if (cid) mirrorFeedSlice(ln, cid); // seed Query mirror for warm paint
    /** Fresh conversation → reset older-page pagination so scroll-up can fetch
     *  history again from the new conv's tail. */
    setHasMore(true);
    setLoadingOlder(false);
    loadingOlderRef.current = false;

    /** Mark this conv as having a live viewer (the global resync backstop keeps
     *  its slice fresh) and ensure the one app-wide message stream is running;
     *  its fan-out routes inbound messages into feedCache, subscribed below. */
    activeFeedLines.add(ln);
    void ensureGlobalStream();

    /** Subscribe to this conv's feedCache slice. Stream + initial load + resync
     *  all write through feedCache, firing this callback. Mirror into local
     *  `events` state and the Query entry. */
    const unsubscribe = feedCache.subscribe(ln, (slice) => {
      if (cancelled || !slice) return;
      setEvents(slice);
      if (cid) mirrorFeedSlice(ln, cid);
    });

    /** Map decoded messages to envelopes and merge into the conv's feedCache
     *  slice (dedup by id, newest-first). Drops register-push control DMs. */
    const applyMessages = (msgs: DecodedMessage[]): void => {
      const prev = feedCache.get(ln) ?? [];
      const seen = new Set(prev.map(e => e.id));
      const additions = msgs.map(m => envelopeOfXmtpMessage(m, ln))
        .filter(e => !isMetroControlBody(e.text) && !seen.has(e.id));
      if (additions.length === 0) {
        if (prev.length > 0) setEvents(prev); // surface cached slice on first paint
        return;
      }
      /** `messages()` returns newest-first; merge new items into the same ordering. */
      feedCache.set(ln, [...additions, ...prev]);
    };

    /** A short initial page (or empty conv) means the whole thread is already
     *  loaded → flip `hasMore` false NOW so the intro/hero renders without waiting
     *  for an `onEndReached` a short list may never fire (missing-hero bug). */
    const noteInitialPage = (count: number): void => {
      if (cancelled) return;
      hasMoreRef.current = count >= PAGE_SIZE; setHasMore(count >= PAGE_SIZE);
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
        noteInitialPage(local.length);
        /** Catch-up: messages delivered while backgrounded arrive via MLS commits
         *  the native stream drops. Only the inbox-wide sync reliably lands them;
         *  run it (coalesced) BEFORE the per-conv sync so the re-read below reflects
         *  the true network tail. */
        await syncInboxOnce();
        if (cancelled) return;
        await conv.sync().catch(() => undefined);
        if (cancelled) return;
        const synced = await conv.messages({ limit: PAGE_SIZE });
        if (cancelled) return;
        applyMessages(synced);
        noteInitialPage(synced.length);
      } catch { /* swallow - global resync backstop will retry */ }
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
   *  loaded event is the oldest; its `sentNs` is the cursor. The RN SDK returns
   *  the `limit` messages strictly before `beforeNs`, newest-first, so we APPEND
   *  them to the end of `events`. Stable identity (refs only) so onEndReached
   *  never churns. Never throws. */
  const loadOlder = useCallback(async (): Promise<void> => {
    const ln = lineRef.current;
    if (loadingOlderRef.current || !hasMoreRef.current || !ln) return;
    const oldest = eventsRef.current[eventsRef.current.length - 1];
    if (!oldest) return;
    /** `oldest.ts` is the ISO ms timestamp from `sentNs`; reconstruct the ns
     *  cursor (sub-ms loss is fine for a strict before-cursor). */
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
      /** Write older pages through feedCache (source of truth); append to the END
       *  to keep newest-first so the slice subscription keeps them. */
      const prev = feedCache.get(ln) ?? eventsRef.current;
      const seen = new Set(prev.map(e => e.id));
      const additions = mapped.filter(e => !seen.has(e.id));
      if (additions.length > 0) feedCache.set(ln, [...prev, ...additions]);
      /** Fewer than a full page of NEW older messages came back → end of history. */
      const newCount = mapped.filter(e => !eventsRef.current.some(x => x.id === e.id)).length;
      if (newCount < PAGE_SIZE) { hasMoreRef.current = false; setHasMore(false); }
    } catch { /* best-effort - scroll-up retries on the next onEndReached */ }
    finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  /** Feed READ flows through TanStack Query (stage 2): the Query-cached mirror of
   *  this conv's feedCache slice (kept in sync by the subscription above). Local
   *  `events` state still drives `eventsRef` for pagination; the value handed to
   *  the screen comes from the shared cache (same feedCache array, identical
   *  order + optimistic-layer input). */
  const feedEvents = useFeedQuery(line, convId, enabled);
  return { events: feedEvents, status, error, inboxId, loadOlder, hasMore, loadingOlder };
}
