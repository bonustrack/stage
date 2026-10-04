import type { HistoryEntry } from '@stage-labs/client/types';
import { persistenceBackend, sealedCache } from './cache';
import { getActiveAccountId } from './accounts';
import { knownActiveAccountId } from './channelsCache';
import {
  EMPTY_SNAPSHOT, decodeSnapshot, encodeSnapshot, lineEntries, snapshotEntries, withLine, withSelf,
  type FeedSnapshot,
} from './feedSnapshot.model';
import { recover, reported } from './errorPolicy';

const WRITE_DELAY_MS = 1_000;

const snapshots = new Map<string, Promise<FeedSnapshot>>();
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
let storeQueue: Promise<void> = Promise.resolve();

function recordName(accountId: string): string {
  return `feed-snapshot.${accountId}`;
}

function queued(task: () => Promise<void>): Promise<void> {
  const run = storeQueue.then(task);
  storeQueue = run.catch(reported('feedSnapshot.store'));
  return storeQueue;
}

async function readSnapshot(accountId: string): Promise<FeedSnapshot> {
  const text = await sealedCache?.read(recordName(accountId)).catch(recover('feedSnapshot.read', null));
  return (typeof text === 'string' ? decodeSnapshot(text) : null) ?? EMPTY_SNAPSHOT;
}

function loadSnapshot(accountId: string): Promise<FeedSnapshot> {
  const known = snapshots.get(accountId);
  if (known) return known;
  const loading = readSnapshot(accountId);
  snapshots.set(accountId, loading);
  return loading;
}

function writeNow(accountId: string): Promise<void> {
  const timer = pendingWrites.get(accountId);
  if (timer === undefined) return storeQueue;
  clearTimeout(timer);
  pendingWrites.delete(accountId);
  return queued(async () => {
    const text = encodeSnapshot(await loadSnapshot(accountId));
    await sealedCache?.write(recordName(accountId), text);
  });
}

function flushAll(): void {
  for (const accountId of [...pendingWrites.keys()]) void writeNow(accountId);
}

if (sealedCache) persistenceBackend.onFlushSignal(flushAll);

function update(accountId: string, change: (snapshot: FeedSnapshot) => FeedSnapshot): void {
  snapshots.set(accountId, loadSnapshot(accountId).then(change));
  if (pendingWrites.has(accountId)) return;
  pendingWrites.set(accountId, setTimeout(() => { void writeNow(accountId); }, WRITE_DELAY_MS));
}

async function activeSnapshot(): Promise<FeedSnapshot | null> {
  if (!sealedCache) return null;
  const accountId = knownActiveAccountId() ?? await getActiveAccountId();
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
  if (!sealedCache || !accountId) return;
  const entries = snapshotEntries(slice);
  const at = Date.now();
  update(accountId, (snapshot) => withLine(snapshot, line, entries, at));
}

export function rememberSelfInboxId(inboxId: string): void {
  const accountId = knownActiveAccountId();
  if (!sealedCache || !accountId || !inboxId) return;
  const loading = loadSnapshot(accountId);
  void loading.then((snapshot) => {
    if (loading === snapshots.get(accountId) && snapshot.self !== inboxId) update(accountId, (s) => withSelf(s, inboxId));
  });
}

export async function forgetFeeds(accountId: string): Promise<void> {
  if (!sealedCache) return;
  const timer = pendingWrites.get(accountId);
  if (timer !== undefined) clearTimeout(timer);
  pendingWrites.delete(accountId);
  snapshots.set(accountId, Promise.resolve(EMPTY_SNAPSHOT));
  const store = sealedCache;
  await queued(() => store.write(recordName(accountId), null));
}
