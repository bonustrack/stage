import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { applyRead, applyUnread } from '@stage-labs/client/xmtp/channelsCache';
import {
  isClearStateType, isPinStateType, isReadStateType, parseClearState, parsePinState, parseReadState,
  pickSyncGroup, shouldApplyReadState, syncGroupName, type PinStateContent, type ReadStateContent,
} from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { getCachedRows, setCachedRows } from './channelsCache';
import { applyRemotePinState } from './pins';
import { applyRemoteClearedChats, ensureClearedChatsLoaded, getClearedChats } from './clearedChats';
import {
  isHiddenConv, onClearedChatsChanged, onPinChanged, onReadStateChanged, registerHiddenConv,
  type PinChange, type ReadStateChange,
} from './readSyncRegistry';
import { setLastReadNs, setMarkedUnreadFlag } from './xmtp.client';
import { xmtpSendJson } from './xmtp.messages';
import { createSyncGroup, listSyncGroups, recentSyncMessages, syncConversation } from './xmtp.readSync';
import { waitForXmtpReady } from './xmtp.state';
import { subscribeAllMessages } from './xmtp.stream';
import { lineOfConv, type StreamMsg } from './xmtp.types';
import { CLEAR_STATE_CODEC, PIN_STATE_CODEC, READ_STATE_CODEC, type JsonCodec } from './xmtpJsonCodecs';

const CURSOR_PREFIX = 'readSync.cursor.';
const REPLAY_LIMIT = 500;
const FIRST_REPLAY_LIMIT = 5000;
const CLEARED_KEY = 'cleared';
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
const PIN_ORDER_KEY = 'pinOrder';

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
  if (state === null) return;
  const key = state.order === undefined ? pinKey(state.convId) : PIN_ORDER_KEY;
  if (!shouldApplyReadState(localAt.get(key), state.at)) return;
  localAt.set(key, state.at);
  await applyRemotePinState(state);
}

async function applyClearMessage(m: RowMessage): Promise<void> {
  const state = parseClearState(m.content);
  if (state !== null) await applyRemoteClearedChats(state.cleared);
}

async function applyMessage(m: RowMessage): Promise<void> {
  if (isReadStateType(m.contentTypeId)) await applyReadMessage(m);
  else if (isPinStateType(m.contentTypeId)) await applyPinMessage(m);
  else if (isClearStateType(m.contentTypeId)) await applyClearMessage(m);
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
  const messages = (await recentSyncMessages(id, cursor === 0 ? FIRST_REPLAY_LIMIT : REPLAY_LIMIT))
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
  await ensureClearedChatsLoaded();
  try {
    const id = await ensureGroup(rec.address);
    if (token === bootToken) await replay(rec.id, id);
  } catch (err) {
    warn('boot', err);
  }
}

async function withGroup(send: (groupId: string) => Promise<unknown>): Promise<void> {
  try {
    const rec = await getActiveAccount().catch(() => null);
    if (rec === null) return;
    await send(await ensureGroup(rec.address));
  } catch (err) {
    warn('publish', err);
  }
}

function publish<T>(codec: JsonCodec<T>, content: T): void {
  void withGroup((id) => xmtpSendJson(lineOfConv(id), codec, content));
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
  debounce(readKey(change.convId), () => { publish(READ_STATE_CODEC, content); });
}

function queuePinPublish(change: PinChange): void {
  const at = Date.now();
  localAt.set(pinKey(change.convId), at);
  localAt.set(PIN_ORDER_KEY, at);
  const content: PinStateContent = { convId: change.convId, pinned: change.pinned, order: [...change.order], at };
  debounce(PIN_ORDER_KEY, () => { publish(PIN_STATE_CODEC, content); });
}

function queueClearedPublish(): void {
  debounce(CLEARED_KEY, () => { publish(CLEAR_STATE_CODEC, { cleared: getClearedChats() }); });
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
  onClearedChatsChanged(queueClearedPublish);
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => { void boot(); });
  void boot();
}
