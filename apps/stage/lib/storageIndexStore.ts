import { createRecordStore } from './cache';
import { decodeIndex, encodeIndex, type StorageIndex } from './storageIndex.model';
import { makeListeners } from './storeCore';
import { recover } from './errorPolicy';

const records = createRecordStore('storage.writeIndex');
const latest = new Map<string, StorageIndex>();
const forgotten = makeListeners<string>();

export const onStorageIndexForgotten = forgotten.subscribe;

function recordName(accountId: string): string {
  return `storage-index.${accountId}`;
}

export async function readStorageIndex(accountId: string): Promise<StorageIndex | null> {
  const known = latest.get(accountId);
  if (known !== undefined) return known;
  const text = await records.read(recordName(accountId)).catch(recover('storage.readIndex', null));
  return typeof text === 'string' ? decodeIndex(text) : null;
}

export function writeStorageIndex(accountId: string, index: StorageIndex): void {
  latest.set(accountId, index);
  records.write(recordName(accountId), () => encodeIndex(index));
}

export async function forgetStorageIndex(accountId: string): Promise<void> {
  latest.delete(accountId);
  const removed = records.remove(recordName(accountId));
  forgotten.notify(accountId);
  await removed;
}
