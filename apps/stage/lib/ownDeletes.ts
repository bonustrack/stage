import { createValueStore } from './persistedStore';
import { makeListeners, useStoreValue } from './storeCore';
import { reported } from './errorPolicy';

const MAX_IDS = 500;
const NO_IDS: readonly string[] = [];

function parseIds(raw: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : NO_IDS;
  } catch { return NO_IDS; }
}

const stored = createValueStore<readonly string[]>({
  key: 'messages.deleted.', default: NO_IDS, deserialize: parseIds, serialize: (ids) => JSON.stringify(ids), perAccount: true,
});
const listeners = makeListeners();
let snapshotOf: readonly string[] = NO_IDS;
let snapshot: ReadonlySet<string> = new Set();

export function getOwnDeletes(): ReadonlySet<string> {
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

export function markOwnDelete(messageId: string): Promise<void> {
  return update(ids => (ids.includes(messageId) ? ids : [...ids, messageId].slice(-MAX_IDS)));
}

export function unmarkOwnDelete(messageId: string): Promise<void> {
  return update(ids => (ids.includes(messageId) ? ids.filter(id => id !== messageId) : ids));
}

function primeOwnDeletes(): void {
  void stored.load().then(() => { listeners.notify(); }).catch(reported('ownDeletes.load'));
}

export function useOwnDeletes(): ReadonlySet<string> {
  return useStoreValue(listeners.subscribe, getOwnDeletes, primeOwnDeletes);
}
