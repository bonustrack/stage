import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { applyRead, applyUnread, type CachedChannelRow } from '@stage-labs/client/xmtp/channelsCache';
import {
  collectSyncReplay, isBoardStateType, isClearStateType, isPinStateType, isReadStateType, pickPublishGroup,
  shouldApplyReadState, syncGroupName, type BoardStateContent, type PinStateContent, type ReadStateContent,
  type SyncGroupState, type SyncReplay,
} from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { getCachedRows, setCachedRows } from './channelsCache';
import { applyRemotePinState, loadPinnedOrder } from './pins';
import { applyRemoteClearedChats, ensureClearedChatsLoaded, getClearedChats } from './clearedChats';
import { applyRemoteBoardOrder, loadBoardOrder } from './boardOrder';
import {
  isHiddenConv, onBoardOrderChanged, onClearedChatsChanged, onPinChanged, onReadStateChanged, registerHiddenConv,
  type BoardOrderChange, type PinChange, type ReadStateChange,
} from './readSyncRegistry';
import { setLastReadNs, setMarkedUnreadFlag } from './xmtp.client';
import { rowIdOfConv } from './xmtp.conv';
import { xmtpSendJson } from './xmtp.messages';
import {
  createSyncGroup, isOwnSyncGroup, listSyncGroups, recentSyncMessages, syncConversation,
} from './xmtp.readSync';
import { waitForXmtpReady } from './xmtp.state';
import { subscribeAllMessages } from './xmtp.stream';
import { lineOfConv, type StreamMsg } from './xmtp.types';
import {
  BOARD_STATE_CODEC, CLEAR_STATE_CODEC, PIN_STATE_CODEC, READ_STATE_CODEC, type JsonCodec,
} from './xmtpJsonCodecs';
import { report, reported, recover, ignored } from './errorPolicy';

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
const nudgedFrom = new Set<string>();

function readKey(convId: string): string { return `read:${convId}`; }
function pinKey(convId: string): string { return `pin:${convId}`; }
const PIN_ORDER_KEY = 'pinOrder';
const BOARD_ORDER_KEY = 'boardOrder';
const STATE_TYPES = [isReadStateType, isPinStateType, isClearStateType, isBoardStateType];

function patchedRows<R extends CachedChannelRow>(rows: R[], state: ReadStateContent): R[] {
  const next = state.markedUnread ? applyUnread(rows, state.convId) : applyRead(rows, state.convId, state.lastReadNs);
  return next ?? rows;
}

async function readStateForRows(state: ReadStateContent): Promise<ReadStateContent> {
  return { ...state, convId: await rowIdOfConv(state.convId) };
}

async function pinStateForRows(state: PinStateContent): Promise<PinStateContent> {
  const convId = await rowIdOfConv(state.convId);
  if (state.order === undefined) return { ...state, convId };
  const order = [...new Set(await Promise.all(state.order.map(rowIdOfConv)))];
  return { ...state, convId, order };
}

async function applyReadStates(remote: readonly ReadStateContent[]): Promise<void> {
  const reads = await Promise.all(remote.map(readStateForRows));
  const before = getCachedRows();
  let rows = before;
  for (const state of reads) {
    if (!shouldApplyReadState(localAt.get(readKey(state.convId)), state.at)) continue;
    localAt.set(readKey(state.convId), state.at);
    await setLastReadNs(state.convId, state.lastReadNs);
    await setMarkedUnreadFlag(state.convId, state.markedUnread);
    if (rows) rows = patchedRows(rows, state);
  }
  if (rows && rows !== before) setCachedRows(rows);
}

async function applyPinStates(remote: readonly PinStateContent[]): Promise<void> {
  for (const state of await Promise.all(remote.map(pinStateForRows))) {
    const key = state.order === undefined ? pinKey(state.convId) : PIN_ORDER_KEY;
    if (!shouldApplyReadState(localAt.get(key), state.at)) continue;
    localAt.set(key, state.at);
    await applyRemotePinState(state);
  }
}

async function applyBoardState(accountId: string, state: BoardStateContent): Promise<void> {
  if (!shouldApplyReadState(localAt.get(BOARD_ORDER_KEY), state.at)) return;
  localAt.set(BOARD_ORDER_KEY, state.at);
  await applyRemoteBoardOrder(accountId, state.order);
}

async function applyReplay(accountId: string, replay: SyncReplay): Promise<void> {
  await applyReadStates(replay.reads);
  await applyPinStates(replay.pins);
  if (replay.cleared !== null) await applyRemoteClearedChats(replay.cleared);
  if (replay.board !== null) await applyBoardState(accountId, replay.board);
}

function isStateMessage(m: RowMessage): boolean {
  return STATE_TYPES.some((isType) => isType(m.contentTypeId));
}

async function knownSyncGroups(): Promise<SyncGroupState[]> {
  const groups = await listSyncGroups();
  for (const g of groups) registerHiddenConv(g.id);
  return groups;
}

async function chooseGroup(address: string, groups: readonly SyncGroupState[]): Promise<string> {
  const chosen = pickPublishGroup(groups);
  const id = chosen === null ? await createSyncGroup(syncGroupName(address)) : chosen.id;
  registerHiddenConv(id);
  groupId = id;
  return id;
}

async function ensureGroup(address: string): Promise<string> {
  return groupId ?? chooseGroup(address, await knownSyncGroups());
}

interface GroupReplay { id: string; cursorKey: string; cursor: number; messages: RowMessage[] }

async function readGroup(accountId: string, group: SyncGroupState): Promise<GroupReplay> {
  if (group.active) await syncConversation(group.id).catch(reported('readSync.sync'));
  const cursorKey = `${CURSOR_PREFIX}${accountId}.${group.id}`;
  const cursor = Number(await appStorage.get(cursorKey).catch(recover('readSync.cursor', null))) || 0;
  const messages = await recentSyncMessages(group.id, cursor === 0 ? FIRST_REPLAY_LIMIT : REPLAY_LIMIT)
    .catch(recover<RowMessage[]>('readSync.messages', []));
  return { id: group.id, cursorKey, cursor, messages: messages.filter((m) => m.sentNs > cursor) };
}

async function replay(accountId: string, target: string, groups: readonly SyncGroupState[]): Promise<void> {
  const batches: GroupReplay[] = [];
  for (const group of groups) batches.push(await readGroup(accountId, group));
  await applyReplay(accountId, collectSyncReplay(batches.flatMap((b) => b.messages), 0));
  for (const b of batches) {
    const latest = b.messages.reduce((max, m) => Math.max(max, m.sentNs), b.cursor);
    if (latest > b.cursor) await appStorage.set(b.cursorKey, String(latest)).catch(ignored(undefined, 'cache'));
    if (b.id !== target && b.messages.some(isStateMessage)) nudgeFrom(b.id);
  }
}

async function boot(): Promise<void> {
  const token = ++bootToken;
  groupId = null;
  localAt.clear();
  if (!(await waitForXmtpReady())) return;
  const rec = await getActiveAccount().catch(recover('readSync.boot', null));
  if (rec === null || token !== bootToken) return;
  await ensureClearedChatsLoaded();
  try {
    const groups = await knownSyncGroups();
    const target = await chooseGroup(rec.address, groups);
    if (token === bootToken) await replay(rec.id, target, groups);
  } catch (err) {
    report('readSync.boot', err);
  }
}

async function withGroup(
  send: (groupId: string, accountId: string) => Promise<unknown>, onlyFor?: string,
): Promise<void> {
  try {
    const rec = await getActiveAccount();
    if (rec === null || (onlyFor !== undefined && rec.id !== onlyFor)) return;
    await send(await ensureGroup(rec.address), rec.id);
  } catch (err) {
    report('readSync.publish', err);
  }
}

function publish<T>(codec: JsonCodec<T>, content: T, onlyFor?: string): void {
  void withGroup((id) => xmtpSendJson(lineOfConv(id), codec, content), onlyFor);
}

function stampBoardState(order: readonly string[]): BoardStateContent {
  const at = Date.now();
  localAt.set(BOARD_ORDER_KEY, at);
  return { order: [...order], at };
}

async function publishBoardSnapshot(line: string, accountId: string): Promise<void> {
  const order = await loadBoardOrder(accountId);
  if (order.length === 0) return;
  await xmtpSendJson(line, BOARD_STATE_CODEC, stampBoardState(order));
}

async function publishSnapshot(target: string, accountId: string): Promise<void> {
  const line = lineOfConv(target);
  await xmtpSendJson(line, CLEAR_STATE_CODEC, { cleared: getClearedChats() });
  await publishBoardSnapshot(line, accountId);
  const order = await loadPinnedOrder();
  const first = order[0];
  if (first === undefined) return;
  const at = Date.now();
  localAt.set(PIN_ORDER_KEY, at);
  await xmtpSendJson(line, PIN_STATE_CODEC, { convId: first, pinned: true, order: [...order], at });
}

function nudgeFrom(sourceId: string): void {
  if (nudgedFrom.has(sourceId)) return;
  nudgedFrom.add(sourceId);
  groupId = null;
  void withGroup((target, accountId) => (target === sourceId ? Promise.resolve() : publishSnapshot(target, accountId)));
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

function queueBoardPublish(change: BoardOrderChange): void {
  const content = stampBoardState(change.order);
  debounce(BOARD_ORDER_KEY, () => { publish(BOARD_STATE_CODEC, content, change.accountId); });
}

function queueClearedPublish(): void {
  debounce(CLEARED_KEY, () => { publish(CLEAR_STATE_CODEC, { cleared: getClearedChats() }); });
}

async function adoptSyncGroup(convId: string): Promise<string | null> {
  const rec = await getActiveAccount().catch(recover('readSync.adopt', null));
  if (rec === null) return null;
  if (isHiddenConv(convId)) return rec.id;
  if (!(await isOwnSyncGroup(convId, rec.address).catch(recover('readSync.adopt', false)))) return null;
  registerHiddenConv(convId);
  return rec.id;
}

async function onStateMessage(convId: string, m: RowMessage): Promise<void> {
  const accountId = await adoptSyncGroup(convId);
  if (accountId === null) return;
  await applyReplay(accountId, collectSyncReplay([m], 0));
  if (groupId !== null && convId !== groupId) nudgeFrom(convId);
}

function onStreamMessage(m: StreamMsg): void {
  if (m.convId === null || !isStateMessage(m.msg)) return;
  void onStateMessage(m.convId, m.msg).catch(reported('readSync.stream'));
}

export function startReadSync(): void {
  if (started) return;
  started = true;
  onReadStateChanged(queueReadPublish);
  onPinChanged(queuePinPublish);
  onClearedChatsChanged(queueClearedPublish);
  onBoardOrderChanged(queueBoardPublish);
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => { nudgedFrom.clear(); void boot(); });
  void boot();
}
