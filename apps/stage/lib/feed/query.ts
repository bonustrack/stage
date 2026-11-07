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

function mirrorSlice(line: string, slice: HistoryEntry[] | undefined): void {
  if (!isFeedLoaded(line)) return;
  getQueryClient().setQueryData<HistoryEntry[]>(feedQueryKey(getAccountEpoch(), line), slice ?? []);
}

function persistSlice(line: string, slice: HistoryEntry[] | undefined): void {
  if (slice === undefined || feedCache.cachedIds(line) !== undefined) return;
  rememberFeed(line, slice);
}

let bridgeStarted = false;

function ensureFeedQueryBridge(): void {
  if (bridgeStarted) return;
  bridgeStarted = true;
  feedCache.subscribeAll((line, slice) => {
    mirrorSlice(line, slice);
    persistSlice(line, slice);
  });
}

export function openFeedLine(line: string): () => void {
  ensureFeedQueryBridge();
  return holdFeedLine(line);
}
