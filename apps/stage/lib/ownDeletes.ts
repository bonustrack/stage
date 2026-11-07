import { createValueStore } from './persistedStore';
import { makeListeners, storedStrings, useStoreValue } from './storeCore';
import { reported } from './errorPolicy';

const MAX_IDS = 500;
const NO_IDS: readonly string[] = [];

const stored = createValueStore<readonly string[]>({ key: 'messages.deleted.', default: NO_IDS, schema: storedStrings, perAccount: true });
const listeners = makeListeners();
let snapshotOf: readonly string[] = NO_IDS;
let snapshot: ReadonlySet<string> = new Set();

function getOwnDeletes(): ReadonlySet<string> {
  const ids = stored.get();
  if (ids !== snapshotOf) {
    snapshotOf = ids;
    snapshot = new Set(ids);
  }
  return snapshot;
}

export async function ownDeletesReady(): Promise<ReadonlySet<string>> {
  await stored.load();
  return getOwnDeletes();
}

async function update(next: (ids: readonly string[]) => readonly string[]): Promise<void> {
  await stored.update(next);
  listeners.notify();
}

export async function deleteForEveryone(messageId: string, send: (messageId: string) => Promise<unknown>): Promise<void> {
  await update((ids) => (ids.includes(messageId) ? ids : [...ids, messageId].slice(-MAX_IDS)));
  try {
    await send(messageId);
  } catch (err) {
    await update((ids) => (ids.includes(messageId) ? ids.filter((id) => id !== messageId) : ids));
    throw err;
  }
}

function primeOwnDeletes(): void {
  void stored
    .load()
    .then(() => {
      listeners.notify();
    })
    .catch(reported('ownDeletes.load'));
}

export function useOwnDeletes(): ReadonlySet<string> {
  return useStoreValue(listeners.subscribe, getOwnDeletes, primeOwnDeletes);
}
