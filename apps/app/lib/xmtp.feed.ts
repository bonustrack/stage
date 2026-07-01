
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HistoryEntry } from '@stage-labs/client/types';
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

export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
  loadOlder: () => Promise<void>; hasMore: boolean; loadingOlder: boolean;
} {
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

  useEffect(() => {
    if (!enabled || !line) return;
    const ln = line;
    ensureFeedQueryBridge();
    activeFeedLines.add(ln);
    void ensureGlobalStream();
    let cancelled = false;
    void getOrCreateXmtpClient('production')
      .then(c => { if (!cancelled) setInboxId(c.inboxId); })
      .catch(() => undefined);
    setHasMore(true);
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    hasMoreRef.current = true;
    return () => { cancelled = true; activeFeedLines.delete(ln); };
  }, [line, enabled, accountEpoch]);

  const queryKey = messagingKeys.messages(accountEpoch, line ?? '');
  const query = useQuery<HistoryEntry[]>({
    queryKey,
    enabled: enabled && !!line,
    queryFn: () => loadFeedFirstPage(line ?? ''),
    initialData: () => (line ? feedCache.get(line) ?? EMPTY : EMPTY),
    staleTime: 0,
  });
  const events = query.data ?? EMPTY;

  useEffect(() => {
    if (query.isFetching || !query.isFetched) return;
    if (events.length < PAGE_SIZE) { hasMoreRef.current = false; setHasMore(false); }
  }, [query.isFetching, query.isFetched, events.length]);

  const status: XmtpFeedStatus = !enabled || !line ? 'idle'
    : query.isError ? 'error'
      : (query.isSuccess || events.length > 0) ? 'open'
        : 'loading';
  const error = query.error ? (query.error).message : null;

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
    } catch { }
    finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  return { events, status, error, inboxId, loadOlder, hasMore, loadingOlder };
}
