import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HistoryEntry } from '@stage-labs/client/types';
import { useAccountEpoch } from '../accountEpoch';
import { xmtpClient } from '../xmtp.client';
import { sdk } from '../xmtp.sdk';
import { feedCache, feedGeneration } from './cache';
import { isFeedLoaded } from './lines';
import { ensureGlobalStream } from '../xmtp.stream';
import { feedQueryKey, openFeedLine, queriedFeed } from './query';
import { loadFeedFirstPage, loadFeedOlderPage } from './load';
import type { XmtpFeedStatus } from '../xmtp.types';
import { report, reported } from '../errorPolicy';
import { feedStartId, useFeedStartId } from './start';
import { cachedSelfInboxId, rememberSelfInboxId } from './snapshot';
import { isAtFeedStart } from './start.model';

const EMPTY: HistoryEntry[] = [];

function feedStatus(active: boolean, failed: boolean, ready: boolean): XmtpFeedStatus {
  if (!active) return 'idle';
  if (failed) return 'error';
  return ready ? 'open' : 'loading';
}

export function useXmtpFeed(
  line: string | null,
  enabled: boolean,
): {
  events: HistoryEntry[];
  status: XmtpFeedStatus;
  error: string | null;
  inboxId: string;
  loadOlder: () => Promise<void>;
  hasMore: boolean;
  loadingOlder: boolean;
  retry: () => void;
} {
  const accountEpoch = useAccountEpoch();
  const firstId = useFeedStartId(line);
  const [inboxId, setInboxId] = useState<string>('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const olderFailedRef = useRef(false);
  const lineRef = useRef(line);
  lineRef.current = line;
  const epochRef = useRef(accountEpoch);
  epochRef.current = accountEpoch;

  useEffect(() => {
    if (!enabled || !line) return;
    const ln = line;
    const release = openFeedLine(ln);
    void ensureGlobalStream();
    let cancelled = false;
    const generation = feedGeneration();
    setInboxId('');
    void cachedSelfInboxId()
      .then((id) => {
        if (!cancelled && generation.current() && id) setInboxId((prev) => prev || id);
      })
      .catch(reported('feed.cachedSelf'));
    void xmtpClient()
      .then((c) => {
        if (cancelled || !generation.current()) return;
        const inboxId = sdk.inboxIdOf(c);
        rememberSelfInboxId(inboxId);
        setInboxId(inboxId);
      })
      .catch(reported('feed.client'));
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    olderFailedRef.current = false;
    return () => {
      cancelled = true;
      release();
    };
  }, [line, enabled, accountEpoch]);

  const queryKey = feedQueryKey(accountEpoch, line ?? '');
  const query = useQuery<HistoryEntry[]>({
    queryKey,
    enabled: enabled && !!line,
    queryFn: () => loadFeedFirstPage(line ?? ''),
    initialData: () => (line && isFeedLoaded(line) ? (feedCache.get(line) ?? EMPTY) : EMPTY),
    staleTime: 0,
  });
  const events = query.data ?? EMPTY;
  const reachedStart = isAtFeedStart(events[events.length - 1]?.id, firstId);

  const status = feedStatus(enabled && !!line, query.isError, query.isFetched || events.length > 0);
  const error = query.error?.message ?? null;
  const { refetch } = query;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const loadOlder = useCallback(async (): Promise<void> => {
    const ln = lineRef.current;
    if (loadingOlderRef.current || olderFailedRef.current || !ln) return;
    const slice = queriedFeed(epochRef.current, ln) ?? feedCache.get(ln) ?? EMPTY;
    const oldest = slice[slice.length - 1];
    if (!oldest || isAtFeedStart(oldest.id, feedStartId(ln))) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      await loadFeedOlderPage(ln, oldest);
    } catch (err) {
      report('feed.loadOlder', err);
      olderFailedRef.current = true;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  return { events, status, error, inboxId, loadOlder, hasMore: !reachedStart, loadingOlder, retry };
}
