import type { HistoryEntry } from '@stage-labs/client/types';
import { createRecordStore } from '../cache';
import { currentAccountId } from '../accounts';
import { knownActiveAccountId } from '../accountSelection';
import {
  EMPTY_SNAPSHOT,
  decodeSnapshot,
  encodeSnapshot,
  lineEntries,
  snapshotEntries,
  withLine,
  withSelf,
  type FeedSnapshot,
} from './snapshot.model';
import { recover } from '../errorPolicy';

const records = createRecordStore('feedSnapshot.store');
const snapshots = new Map<string, Promise<FeedSnapshot | null>>();

function recordName(accountId: string): string {
  return `feed-snapshot.${accountId}`;
}

async function readSnapshot(accountId: string): Promise<FeedSnapshot | null> {
  const text = await records.read(recordName(accountId)).catch(recover('feedSnapshot.read', undefined));
  if (text === undefined) return null;
  return (text === null ? null : decodeSnapshot(text)) ?? EMPTY_SNAPSHOT;
}

function remember(accountId: string, loading: Promise<FeedSnapshot | null>): Promise<FeedSnapshot | null> {
  snapshots.set(accountId, loading);
  void loading.then((snapshot) => {
    if (snapshot === null && snapshots.get(accountId) === loading) snapshots.delete(accountId);
  });
  return loading;
}

function loadSnapshot(accountId: string): Promise<FeedSnapshot | null> {
  return snapshots.get(accountId) ?? remember(accountId, readSnapshot(accountId));
}

function update(accountId: string, change: (snapshot: FeedSnapshot) => FeedSnapshot): void {
  const next = remember(
    accountId,
    loadSnapshot(accountId).then((snapshot) => (snapshot === null ? null : change(snapshot))),
  );
  void next.then((changed) => {
    if (changed !== null) records.write(recordName(accountId), async () => encodeSnapshot((await loadSnapshot(accountId)) ?? changed));
  });
}

async function activeSnapshot(): Promise<FeedSnapshot | null> {
  const accountId = await currentAccountId();
  if (!accountId) return null;
  const loading = loadSnapshot(accountId);
  const snapshot = await loading;
  return loading === snapshots.get(accountId) ? snapshot : null;
}

export async function cachedFeed(line: string): Promise<HistoryEntry[] | null> {
  const snapshot = await activeSnapshot();
  return snapshot ? lineEntries(snapshot, line) : null;
}

export async function cachedSelfInboxId(): Promise<string | null> {
  return (await activeSnapshot())?.self ?? null;
}

export function rememberFeed(line: string, slice: readonly HistoryEntry[]): void {
  const accountId = knownActiveAccountId();
  if (!accountId) return;
  const entries = snapshotEntries(slice);
  const at = Date.now();
  update(accountId, (snapshot) => withLine(snapshot, line, entries, at));
}

export function rememberSelfInboxId(inboxId: string): void {
  const accountId = knownActiveAccountId();
  if (!accountId || !inboxId) return;
  const loading = loadSnapshot(accountId);
  void loading.then((snapshot) => {
    if (loading === snapshots.get(accountId) && snapshot !== null && snapshot.self !== inboxId)
      update(accountId, (s) => withSelf(s, inboxId));
  });
}

export async function forgetFeeds(accountId: string): Promise<void> {
  snapshots.set(accountId, Promise.resolve(EMPTY_SNAPSHOT));
  await records.remove(recordName(accountId));
}
