import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HistoryEntry } from '@stage-labs/client/types';
import { useAccountEpoch } from './accountEpoch';
import { getOrCreateXmtpClient } from './xmtp.client';
import { feedCache } from './xmtp.state.core';
import { holdFeedLine } from './feedLines';
import { ensureGlobalStream } from './xmtp.stream';
import { getQueryClient } from './queryClient';
import { messagingKeys } from '../modules/messaging/queries';
import {
  ensureFeedQueryBridge, loadFeedFirstPage, loadFeedOlderPage,
} from '../modules/messaging/feedQuery';
import { type XmtpFeedStatus } from './xmtp.types';
import { report, reported } from './errorPolicy';
import { feedStartId, useFeedStartId } from './feedStart';
import { isAtFeedStart } from './feedStart.model';

const EMPTY: HistoryEntry[] = [];

function feedStatus(active: boolean, failed: boolean, ready: boolean): XmtpFeedStatus {
  if (!active) return 'idle';
  if (failed) return 'error';
  return ready ? 'open' : 'loading';
}

export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
  loadOlder: () => Promise<void>; hasMore: boolean; loadingOlder: boolean;
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
    ensureFeedQueryBridge();
    const release = holdFeedLine(ln);
    void ensureGlobalStream();
    let cancelled = false;
    void getOrCreateXmtpClient('production')
      .then(c => { if (!cancelled) setInboxId(c.inboxId); })
      .catch(reported('feed.client'));
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    olderFailedRef.current = false;
    return () => { cancelled = true; release(); };
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
  const reachedStart = isAtFeedStart(events[events.length - 1]?.id, firstId);

  const status = feedStatus(enabled && !!line, query.isError, query.isFetched || events.length > 0);
  const error = query.error ? (query.error).message : null;

  const loadOlder = useCallback(async (): Promise<void> => {
    const ln = lineRef.current;
    if (loadingOlderRef.current || olderFailedRef.current || !ln) return;
    const slice = getQueryClient().getQueryData<HistoryEntry[]>(
      messagingKeys.messages(epochRef.current, ln),
    ) ?? feedCache.get(ln) ?? EMPTY;
    const oldest = slice[slice.length - 1];
    if (!oldest || isAtFeedStart(oldest.id, feedStartId(ln))) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      await loadFeedOlderPage(ln, oldest);
    } catch (err) {
      report('feed.loadOlder', err);
      olderFailedRef.current = true;
    }
    finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  return { events, status, error, inboxId, loadOlder, hasMore: !reachedStart, loadingOlder };
}
