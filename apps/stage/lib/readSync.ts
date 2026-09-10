import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { applyRead, applyUnread } from '@stage-labs/client/xmtp/channelsCache';
import {
  isPinStateType, isReadStateType, parsePinState, parseReadState, pickSyncGroup, shouldApplyReadState,
  syncGroupName, type PinStateContent, type ReadStateContent,
} from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { getCachedRows, setCachedRows } from './channelsCache';
import { applyRemotePin } from './pins';
import {
  isHiddenConv, onPinChanged, onReadStateChanged, registerHiddenConv, type PinChange, type ReadStateChange,
} from './readSyncRegistry';
import { setLastReadNs, setMarkedUnreadFlag } from './xmtp.client';
import {
  createSyncGroup, listSyncGroups, recentSyncMessages, sendPinState, sendReadState, syncConversation,
} from './xmtp.readSync';
import { waitForXmtpReady } from './xmtp.state';
import { subscribeAllMessages } from './xmtp.stream';
import type { StreamMsg } from './xmtp.types';

const CURSOR_PREFIX = 'readSync.cursor.';
const REPLAY_LIMIT = 500;
const PUBLISH_DEBOUNCE_MS = 800;

let started = false;
let bootToken = 0;
let groupId: string | null = null;
const localAt = new Map<string, number>();
const pendingPublish = new Map<string, ReturnType<typeof setTimeout>>();

function warn(step: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') console.warn(`read sync ${step} failed`, err instanceof Error ? err.message : err);
}

function patchRows(state: ReadStateContent): void {
  const rows = getCachedRows();
  if (!rows) return;
  const next = state.markedUnread ? applyUnread(rows, state.convId) : applyRead(rows, state.convId, state.lastReadNs);
  if (next !== null) setCachedRows(next);
}

function readKey(convId: string): string { return `read:${convId}`; }
function pinKey(convId: string): string { return `pin:${convId}`; }

async function applyReadMessage(m: RowMessage): Promise<void> {
  const state = parseReadState(m.content);
  if (state === null || !shouldApplyReadState(localAt.get(readKey(state.convId)), state.at)) return;
  localAt.set(readKey(state.convId), state.at);
  await setLastReadNs(state.convId, state.lastReadNs);
  await setMarkedUnreadFlag(state.convId, state.markedUnread);
  patchRows(state);
}

async function applyPinMessage(m: RowMessage): Promise<void> {
  const state = parsePinState(m.content);
  if (state === null || !shouldApplyReadState(localAt.get(pinKey(state.convId)), state.at)) return;
  localAt.set(pinKey(state.convId), state.at);
  await applyRemotePin(state.convId, state.pinned);
}

async function applyMessage(m: RowMessage): Promise<void> {
  if (isReadStateType(m.contentTypeId)) await applyReadMessage(m);
  else if (isPinStateType(m.contentTypeId)) await applyPinMessage(m);
}

async function ensureGroup(address: string): Promise<string> {
  if (groupId !== null) return groupId;
  const groups = await listSyncGroups();
  for (const g of groups) registerHiddenConv(g.id);
  const chosen = pickSyncGroup(groups);
  const id = chosen === null ? await createSyncGroup(syncGroupName(address)) : chosen.id;
  registerHiddenConv(id);
  groupId = id;
  return id;
}

async function replay(accountId: string, id: string): Promise<void> {
  await syncConversation(id).catch((err: unknown) => { warn('sync', err); });
  const cursorKey = CURSOR_PREFIX + accountId;
  const cursor = Number(await appStorage.get(cursorKey).catch(() => null)) || 0;
  const messages = (await recentSyncMessages(id, REPLAY_LIMIT))
    .filter((m) => m.sentNs > cursor)
    .sort((a, b) => a.sentNs - b.sentNs);
  let latest = cursor;
  for (const m of messages) {
    await applyMessage(m);
    latest = Math.max(latest, m.sentNs);
  }
  if (latest > cursor) await appStorage.set(cursorKey, String(latest)).catch(() => undefined);
}

async function boot(): Promise<void> {
  const token = ++bootToken;
  groupId = null;
  localAt.clear();
  if (!(await waitForXmtpReady())) return;
  const rec = await getActiveAccount().catch(() => null);
  if (rec === null || token !== bootToken) return;
  try {
    const id = await ensureGroup(rec.address);
    if (token === bootToken) await replay(rec.id, id);
  } catch (err) {
    warn('boot', err);
  }
}

async function withGroup(send: (groupId: string) => Promise<void>): Promise<void> {
  try {
    const rec = await getActiveAccount().catch(() => null);
    if (rec === null) return;
    await send(await ensureGroup(rec.address));
  } catch (err) {
    warn('publish', err);
  }
}

function debounce(key: string, fn: () => void): void {
  const pending = pendingPublish.get(key);
  if (pending !== undefined) clearTimeout(pending);
  pendingPublish.set(key, setTimeout(() => {
    pendingPublish.delete(key);
    fn();
  }, PUBLISH_DEBOUNCE_MS));
}

function queueReadPublish(change: ReadStateChange): void {
  const at = Date.now();
  localAt.set(readKey(change.convId), at);
  const content: ReadStateContent = { ...change, at };
  debounce(readKey(change.convId), () => { void withGroup((id) => sendReadState(id, content)); });
}

function queuePinPublish(change: PinChange): void {
  const at = Date.now();
  localAt.set(pinKey(change.convId), at);
  const content: PinStateContent = { ...change, at };
  debounce(pinKey(change.convId), () => { void withGroup((id) => sendPinState(id, content)); });
}

function onStreamMessage(m: StreamMsg): void {
  if (!isHiddenConv(m.convId)) return;
  void applyMessage(m.msg);
}

export function startReadSync(): void {
  if (started) return;
  started = true;
  onReadStateChanged(queueReadPublish);
  onPinChanged(queuePinPublish);
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => { void boot(); });
  void boot();
}
