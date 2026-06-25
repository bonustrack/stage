import { createSyncArchivedStore } from '@stage-labs/client/xmtp/archived';

const store = createSyncArchivedStore({
  get: (key: string): string | null => localStorage.getItem(key),
  set: (key: string, value: string): void => { localStorage.setItem(key, value); },
}, 'metro.channels.archived');

export function loadArchivedIds(): Set<string> {
  return store.loadCopy();
}

export function isArchived(id: string): boolean {
  return store.has(id);
}

export function toggleArchived(id: string): Set<string> {
  return store.toggle(id);
}

export function subscribeArchived(cb: () => void): () => void {
  return store.subscribe(cb);
}
