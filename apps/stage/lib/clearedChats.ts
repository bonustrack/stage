import { mergeClearedChats, type ClearedChats } from '@stage-labs/client/xmtp/sync/clear';
import { createValueStore } from './persistedStore';
import { makeListeners, storedRecordOf } from './storeCore';

const EMPTY: ClearedChats = {};

const isClearedAt = (value: unknown): value is number => typeof value === 'number';

const prefs = createValueStore<ClearedChats>({
  key: 'channels.cleared.',
  default: EMPTY,
  schema: storedRecordOf(isClearedAt),
  perAccount: true,
});

const localChanges = makeListeners();
export const onClearedChatsChanged = localChanges.subscribe;

export const getClearedChats = prefs.get;

export const useClearedChats = prefs.use;

export const subscribeClearedChats = prefs.subscribe;

export const primeClearedChats = prefs.loadAsync;

export const loadClearedChats = prefs.loadFor;

export async function markChatCleared(peerAddress: string, atMs: number): Promise<void> {
  await prefs.update((cleared) => mergeClearedChats(cleared, { [peerAddress]: atMs }));
  localChanges.notify();
}

export function applyRemoteClearedChats(forAccount: string, incoming: ClearedChats): Promise<void> {
  return prefs.updateFor(forAccount, (cleared) => {
    const next = mergeClearedChats(cleared, incoming);
    return JSON.stringify(next) === JSON.stringify(cleared) ? cleared : next;
  });
}
