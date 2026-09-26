import type { ReadStateContent } from '@stage-labs/client/xmtp/readState';
import { UNSTAMPED_AT } from '@stage-labs/client/xmtp/syncSnapshot';
import { appStorage, secureStorage } from '../platform/storage';
import { persistenceBackend } from './cache';
import { recover, reported } from './errorPolicy';
import { makeReadStateStore, type StoredRead } from './readStateStore.core';

const STORE_KEY = 'readState.v1';
const SAVE_DEBOUNCE_MS = 1_000;
const LAST_READ_PREFIX = 'unread.lastRead.';
const MARKED_UNREAD_PREFIX = 'unread.marked.';

let pendingRaw: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let flushWired = false;

function flushSave(): void {
  if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
  const raw = pendingRaw;
  pendingRaw = null;
  if (raw !== null) appStorage.set(STORE_KEY, raw).catch(reported('readState.save'));
}

function scheduleSave(raw: string): void {
  pendingRaw = raw;
  if (!flushWired) {
    flushWired = true;
    persistenceBackend.onFlushSignal(flushSave);
  }
  saveTimer ??= setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

function parseLastReadNs(raw: string | null): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function legacyRead(convId: string): Promise<StoredRead | null> {
  const read = Promise.all([
    secureStorage.get(LAST_READ_PREFIX + convId),
    secureStorage.get(MARKED_UNREAD_PREFIX + convId),
  ]).then(([lastRead, marked]) => ({
    lastReadNs: parseLastReadNs(lastRead), markedUnread: marked === '1', at: UNSTAMPED_AT,
  }));
  return read.catch(recover('readState.legacy', null));
}

const store = makeReadStateStore({
  load: () => appStorage.get(STORE_KEY),
  save: scheduleSave,
  legacyRead,
  now: () => Date.now(),
});

function readOrReport(convId: string): Promise<StoredRead | null> {
  return store.get(convId).catch(recover('readState.get', null));
}

export async function getLastReadNs(convId: string): Promise<number> {
  return (await readOrReport(convId))?.lastReadNs ?? 0;
}

export async function getMarkedUnread(convId: string): Promise<boolean> {
  return (await readOrReport(convId))?.markedUnread ?? false;
}

export function markConvReadSynced(convId: string): Promise<StoredRead> {
  return store.markRead(convId);
}

export function markConvUnreadSynced(convId: string): Promise<StoredRead> {
  return store.markUnread(convId);
}

export function applyRemoteReadStates(states: readonly ReadStateContent[]): Promise<ReadStateContent[]> {
  return store.applyRemote(states);
}

export function readStateEntries(): Promise<[string, StoredRead][]> {
  return store.entries();
}

export function primeReadStateStore(hasAccounts: boolean): void {
  store.prime(hasAccounts);
}
