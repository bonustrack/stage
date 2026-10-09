import { persistenceBackend, sealedCache } from './cache';
import { PersistentStore } from './cache.shared';
import { decodeIndex, encodeIndex, indexOfRecord, indexRecord, type StorageIndex } from './storageIndex.model';
import { makeListeners } from './storeCore';
import { recover, reported } from './errorPolicy';

const WRITE_DELAY_MS = 1_000;

const fileStores = new Map<string, PersistentStore<Record<string, unknown>>>();
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
const latest = new Map<string, StorageIndex>();
const forgotten = makeListeners<string>();

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

export async function readStorageIndex(accountId: string): Promise<StorageIndex | null> {
  const pending = latest.get(accountId);
  if (pending !== undefined) return pending;
  if (sealedCache) {
    const text = await sealedCache.read(recordName(accountId)).catch(recover('storage.readIndex', null));
    return typeof text === 'string' ? decodeIndex(text) : null;
  }
  const raw = await fileStoreFor(accountId).hydrate().catch(recover('storage.readIndex', null));
  return indexOfRecord(raw);
}

function writeNow(accountId: string): void {
  const timer = pendingWrites.get(accountId);
  if (timer !== undefined) clearTimeout(timer);
  pendingWrites.delete(accountId);
  const index = latest.get(accountId);
  if (index === undefined) return;
  if (sealedCache) void sealedCache.write(recordName(accountId), encodeIndex(index)).catch(reported('storage.writeIndex'));
  else fileStoreFor(accountId).set(indexRecord(index));
}

function flushAll(): void {
  for (const accountId of [...pendingWrites.keys()]) writeNow(accountId);
}

if (sealedCache) persistenceBackend.onFlushSignal(flushAll);

export function writeStorageIndex(accountId: string, index: StorageIndex): void {
  latest.set(accountId, index);
  if (pendingWrites.has(accountId)) return;
  pendingWrites.set(accountId, setTimeout(() => { writeNow(accountId); }, WRITE_DELAY_MS));
}

export async function forgetStorageIndex(accountId: string): Promise<void> {
  const timer = pendingWrites.get(accountId);
  if (timer !== undefined) clearTimeout(timer);
  pendingWrites.delete(accountId);
  latest.delete(accountId);
  forgotten.notify(accountId);
  if (sealedCache) await sealedCache.write(recordName(accountId), null);
  else fileStoreFor(accountId).clear();
}
