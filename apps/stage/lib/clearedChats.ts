import { mergeClearedChats, type ClearedChats } from '@stage-labs/client/xmtp/readState';
import { createValueStore } from './persistedStore';
import { makeListeners } from './storeCore';

const EMPTY: ClearedChats = {};

function parseCleared(raw: string): ClearedChats {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return EMPTY;
    const entries = Object.entries(parsed).filter((e): e is [string, number] => typeof e[1] === 'number');
    return Object.fromEntries(entries);
  } catch { return EMPTY; }
}

const prefs = createValueStore<ClearedChats>({
  key: 'channels.cleared.', default: EMPTY, deserialize: parseCleared, serialize: JSON.stringify, perAccount: true,
});

const localChanges = makeListeners();
export const onClearedChatsChanged = localChanges.subscribe;

export const getClearedChats = prefs.get;

export const useClearedChats = prefs.use;

export const subscribeClearedChats = prefs.subscribe;

export const primeClearedChats = prefs.loadAsync;

export const loadClearedChats = prefs.loadFor;

export async function markChatCleared(peerAddress: string, atMs: number): Promise<void> {
  await prefs.update(cleared => mergeClearedChats(cleared, { [peerAddress]: atMs }));
  localChanges.notify();
}

export function applyRemoteClearedChats(forAccount: string, incoming: ClearedChats): Promise<void> {
  return prefs.updateFor(forAccount, (cleared) => {
    const next = mergeClearedChats(cleared, incoming);
    return JSON.stringify(next) === JSON.stringify(cleared) ? cleared : next;
  });
}
