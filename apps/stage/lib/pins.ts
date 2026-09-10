import { createSetStore } from './persistedStore';
import { notifyPinChanged } from './readSyncRegistry';

const store = createSetStore('channels.pinned');

export const loadPinnedIds = (): Promise<Set<string>> => store.load();

export const isPinned = (convId: string): boolean => store.has(convId);

export async function togglePin(convId: string): Promise<Set<string>> {
  const next = await store.toggle(convId);
  notifyPinChanged({ convId, pinned: next.has(convId) });
  return next;
}

export async function applyRemotePin(convId: string, pinned: boolean): Promise<void> {
  const current = await store.load();
  if (current.has(convId) === pinned) return;
  const next = new Set(current);
  if (pinned) next.add(convId);
  else next.delete(convId);
  await store.set(next);
}

export const subscribePins = (cb: () => void): () => void => store.subscribe(cb);
