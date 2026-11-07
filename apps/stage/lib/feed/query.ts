import type { HistoryEntry } from '@stage-labs/client/types';
import { accountQueryKeyAt, getQueryClient } from '../queryClient';
import { getAccountEpoch } from '../accountEpoch';
import { feedCache } from './cache';
import { holdFeedLine, isFeedLoaded } from './lines';
import { rememberFeed } from './snapshot';

export function feedQueryKey(account: number, line: string) {
  return accountQueryKeyAt('client', account, 'xmtp', 'messages', line);
}

export function queriedFeed(account: number, line: string): HistoryEntry[] | undefined {
  return getQueryClient().getQueryData<HistoryEntry[]>(feedQueryKey(account, line));
}

let bridgeStarted = false;

export function openFeedLine(line: string): () => void {
  if (!bridgeStarted) {
    bridgeStarted = true;
    feedCache.subscribeAll(({ line: changed, slice }) => {
      if (isFeedLoaded(changed)) getQueryClient().setQueryData<HistoryEntry[]>(feedQueryKey(getAccountEpoch(), changed), slice ?? []);
      if (slice !== undefined && feedCache.cachedIds(changed) === undefined) rememberFeed(changed, slice);
    });
  }
  return holdFeedLine(line);
}
