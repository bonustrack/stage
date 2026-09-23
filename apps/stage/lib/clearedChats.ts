import { mergeClearedChats, type ClearedChats } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { notifyClearedChatsChanged } from './readSyncRegistry';
import { makeListeners, useStoreValue } from './storeCore';
import { reported } from './errorPolicy';

const KEY_PREFIX = 'channels.cleared.';
const EMPTY: ClearedChats = {};

let accountId: string | null = null;
let cleared: ClearedChats = EMPTY;
let loading: Promise<void> | null = null;
const listeners = makeListeners();

function parseCleared(raw: string | null): ClearedChats {
  if (raw === null) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return EMPTY;
    const entries = Object.entries(parsed).filter((e): e is [string, number] => typeof e[1] === 'number');
    return Object.fromEntries(entries);
  } catch { return EMPTY; }
}

async function loadForActiveAccount(): Promise<void> {
  const rec = await getActiveAccount();
  const id = rec?.id ?? null;
  if (id === accountId) return;
  const raw = id === null ? null : await appStorage.get(KEY_PREFIX + id);
  accountId = id;
  cleared = parseCleared(raw);
  listeners.notify();
}

export function ensureClearedChatsLoaded(): Promise<void> {
  loading ??= loadForActiveAccount().finally(() => { loading = null; });
  return loading;
}

function commit(next: ClearedChats): void {
  cleared = next;
  listeners.notify();
  if (accountId !== null) void appStorage.set(KEY_PREFIX + accountId, JSON.stringify(next)).catch(reported('clearedChats.save'));
}

export function getClearedChats(): ClearedChats { return cleared; }

function primeClearedChats(): void { void ensureClearedChatsLoaded().catch(reported('clearedChats.load')); }

export function useClearedChats(): ClearedChats {
  return useStoreValue(listeners.subscribe, getClearedChats, primeClearedChats);
}

export async function markChatCleared(peerAddress: string, atMs: number): Promise<void> {
  await ensureClearedChatsLoaded();
  commit(mergeClearedChats(cleared, { [peerAddress]: atMs }));
  notifyClearedChatsChanged();
}

export async function applyRemoteClearedChats(incoming: ClearedChats): Promise<void> {
  await ensureClearedChatsLoaded();
  const next = mergeClearedChats(cleared, incoming);
  if (JSON.stringify(next) !== JSON.stringify(cleared)) commit(next);
}
