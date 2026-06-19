/** The `useXmtpFeed` conversation-feed hook for the app's XMTP client lib.
 *  Extracted from lib/xmtp.ts (phase-2 lint split); re-exported from there.
 *
 *  REACT-QUERY BACKED (refactor/feed-tanstack). The feed no longer hand-rolls
 *  useState over a module-level `feedCache` slice; it renders from a TanStack
 *  query keyed by `messagingKeys.messages(epoch, line)`. `feedCache` stays the
 *  live-write source of truth (the single app-wide stream + resync backstop +
 *  pagination all write it - see xmtp.stream.ts) and a global mirror
 *  (feedQuery.ts `ensureFeedQueryBridge`) copies every slice write into the
 *  shared query cache, so live appends from the stream update this query for
 *  free. The bridge mirrors feedCache to the OPEN feed only; the channels-list
 *  preview comes from HomeScreen.stream.ts via channelsCache. The feed/list
 *  desync (#375) is prevented by the topic-first convId + `resyncActiveFeeds`
 *  path. The query's `queryFn` folds in a sync-on-open step (see
 *  `loadFeedFirstPage`).
 *
 *  The hook's PUBLIC API (events / status / error / inboxId / loadOlder /
 *  hasMore / loadingOlder) is unchanged so its consumer (the conversation view)
 *  needs no rewrite. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HistoryEntry } from './types';
import { useAccountEpoch } from './accountEpoch';
import { getOrCreateXmtpClient } from './xmtp.client';
import { feedCache, activeFeedLines } from './xmtp.state';
import { ensureGlobalStream, PAGE_SIZE } from './xmtp.stream';
import { getQueryClient } from './queryClient';
import { messagingKeys } from '../modules/messaging/queries';
import {
  ensureFeedQueryBridge, loadFeedFirstPage, loadFeedOlderPage,
} from '../modules/messaging/feedQuery';
import { type XmtpFeedStatus } from './xmtp.types';

const EMPTY: HistoryEntry[] = [];

/** Hook: load the existing message history for an XMTP conversation, then keep it
 *  live. Returned `events` are newest-first (the inverted FlatList ordering), the
 *  same shape the old hand-rolled hook returned.
 *
 *  Caller passes a metro line URI (`metro://xmtp/<convId>`). When `enabled` is
 *  false, the hook stays idle - callers use this to suppress loading until the
 *  client is built. */
export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
  loadOlder: () => Promise<void>; hasMore: boolean; loadingOlder: boolean;
} {
  /** Re-init the feed when the active account changes (in-place switch) - the
   *  cached client + feedCache have been swapped out under us, so the query key's
   *  epoch segment changes and react-query refetches against the new inbox. */
  const accountEpoch = useAccountEpoch();
  const [inboxId, setInboxId] = useState<string>('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const hasMoreRef = useRef(true);
  hasMoreRef.current = hasMore;
  const lineRef = useRef(line);
  lineRef.current = line;
  const epochRef = useRef(accountEpoch);
  epochRef.current = accountEpoch;

  /** Register this conv as having a live viewer (drives the resync backstop) and
   *  ensure the single app-wide stream + the feedCache→query mirror are running.
   *  No per-conv stream / poll: the module-level `streamAllMessages` fan-out
   *  routes inbound messages into `feedCache`, which the mirror copies into this
   *  query's cache. */
  useEffect(() => {
    if (!enabled || !line) return;
    const ln = line;
    ensureFeedQueryBridge();
    activeFeedLines.add(ln);
    void ensureGlobalStream();
    /** Resolve the inbox id once so `myUri` (consumer-side) is populated. */
    let cancelled = false;
    void getOrCreateXmtpClient('production')
      .then(c => { if (!cancelled) setInboxId(c.inboxId); })
      .catch(() => undefined);
    /** Fresh conversation → reset older-page pagination so scroll-up can fetch
     *  history again from the new conv's tail. */
    setHasMore(true);
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    hasMoreRef.current = true;
    return () => { cancelled = true; activeFeedLines.delete(ln); };
  }, [line, enabled, accountEpoch]);

  /** The feed query. `initialData` seeds synchronously from feedCache (instant
   *  re-open, no empty flash); the queryFn does the local-first load + the
   *  forced inbox sync on open (#375), writing through feedCache so the mirror
   *  updates THIS query cache. Live appends arrive via the mirror's setQueryData,
   *  so `data` re-renders without the queryFn re-running. */
  const queryKey = messagingKeys.messages(accountEpoch, line ?? '');
  const query = useQuery<HistoryEntry[]>({
    queryKey,
    enabled: enabled && !!line,
    queryFn: () => loadFeedFirstPage(line ?? ''),
    initialData: () => (line ? feedCache.get(line) ?? EMPTY : EMPTY),
    staleTime: 0,
  });
  const events = query.data ?? EMPTY;

  /** A short first page (or empty conv) means the whole thread is already loaded
   *  → flip `hasMore` to false so the conversation intro/hero renders without
   *  waiting for an `onEndReached` a short list may never fire. Keyed on the
   *  fetched length, only after a real fetch settled (not the seeded initial). */
  useEffect(() => {
    if (query.isFetching || !query.isFetched) return;
    if (events.length < PAGE_SIZE) { hasMoreRef.current = false; setHasMore(false); }
  }, [query.isFetching, query.isFetched, events.length]);

  const status: XmtpFeedStatus = !enabled || !line ? 'idle'
    : query.isError ? 'error'
      : (query.isSuccess || events.length > 0) ? 'open'
        : 'loading';
  const error = query.error ? (query.error).message : null;

  /** Fetch the next older page on scroll-up. Stable identity (deps are only refs)
   *  so the FlatList's onEndReached prop never churns. Never throws. */
  const loadOlder = useCallback(async (): Promise<void> => {
    const ln = lineRef.current;
    if (loadingOlderRef.current || !hasMoreRef.current || !ln) return;
    const slice = getQueryClient().getQueryData<HistoryEntry[]>(
      messagingKeys.messages(epochRef.current, ln),
    ) ?? feedCache.get(ln) ?? EMPTY;
    const oldest = slice[slice.length - 1];
    if (!oldest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const more = await loadFeedOlderPage(ln, oldest);
      if (!more) { hasMoreRef.current = false; setHasMore(false); }
    } catch { /* best-effort - scroll-up retries on the next onEndReached */ }
    finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  return { events, status, error, inboxId, loadOlder, hasMore, loadingOlder };
}
