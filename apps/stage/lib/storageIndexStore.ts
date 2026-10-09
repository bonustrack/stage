import { persistenceBackend, sealedCache } from './cache';
import { PersistentStore } from './cache.shared';
import { decodeIndex, encodeIndex, indexOfRecord, indexRecord, type StorageIndex } from './storageIndex.model';
import { makeListeners } from './storeCore';
import { recover, reported } from './errorPolicy';

const WRITE_DELAY_MS = 1_000;
const FILE_FLUSH_MS = 5_000;

const fileStores = new Map<string, PersistentStore<Record<string, unknown>>>();
const fileFlushedAt = new Map<string, number>();
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
const latest = new Map<string, StorageIndex>();
const forgotten = makeListeners<string>();
let sealedQueue: Promise<void> = Promise.resolve();

export const onStorageIndexForgotten = forgotten.subscribe;

function recordName(accountId: string): string {
  return `storage-index.${accountId}`;
}

function fileStoreFor(accountId: string): PersistentStore<Record<string, unknown>> {
  let store = fileStores.get(accountId);
  if (store === undefined) {
    store = new PersistentStore<Record<string, unknown>>(`${recordName(accountId).replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
    fileStores.set(accountId, store);
  }
  return store;
}

function queued(task: () => Promise<void>): Promise<void> {
  const run = sealedQueue.then(task);
  sealedQueue = run.catch(reported('storage.writeIndex'));
  return sealedQueue;
}

export async function readStorageIndex(accountId: string): Promise<StorageIndex | null> {
  const known = latest.get(accountId);
  if (known !== undefined) return known;
  if (sealedCache) {
    const text = await sealedCache.read(recordName(accountId)).catch(recover('storage.readIndex', null));
    return typeof text === 'string' ? decodeIndex(text) : null;
  }
  const raw = await fileStoreFor(accountId).hydrate().catch(recover('storage.readIndex', null));
  return indexOfRecord(raw);
}

function writeSealed(accountId: string): void {
  const timer = pendingWrites.get(accountId);
  if (timer !== undefined) clearTimeout(timer);
  pendingWrites.delete(accountId);
  const index = latest.get(accountId);
  const store = sealedCache;
  if (index === undefined || store === null) return;
  void queued(() => store.write(recordName(accountId), encodeIndex(index)));
}

function writeFile(accountId: string, index: StorageIndex): void {
  const store = fileStoreFor(accountId);
  store.set(indexRecord(index));
  const now = Date.now();
  if (now - (fileFlushedAt.get(accountId) ?? 0) < FILE_FLUSH_MS) return;
  fileFlushedAt.set(accountId, now);
  store.flushNow();
}

function flushSealed(): void {
  for (const accountId of [...pendingWrites.keys()]) writeSealed(accountId);
}

if (sealedCache) persistenceBackend.onFlushSignal(flushSealed);

export function writeStorageIndex(accountId: string, index: StorageIndex): void {
  latest.set(accountId, index);
  if (!sealedCache) { writeFile(accountId, index); return; }
  if (pendingWrites.has(accountId)) return;
  pendingWrites.set(accountId, setTimeout(() => { writeSealed(accountId); }, WRITE_DELAY_MS));
}

export async function forgetStorageIndex(accountId: string): Promise<void> {
  const timer = pendingWrites.get(accountId);
  if (timer !== undefined) clearTimeout(timer);
  pendingWrites.delete(accountId);
  latest.delete(accountId);
  forgotten.notify(accountId);
  const store = sealedCache;
  if (store) await queued(() => store.write(recordName(accountId), null));
  else fileStoreFor(accountId).clear();
}
