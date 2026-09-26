import type { RowMessage, StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { applyRead, applyUnread, type CachedChannelRow } from '@stage-labs/client/xmtp/channelsCache';
import {
  pickPublishGroup, shouldApplyReadState, syncGroupName, type BoardStateContent, type PinStateContent,
  type ReadStateContent, type SyncGroupState, type SyncReplay,
} from '@stage-labs/client/xmtp/readState';
import {
  collectSnapshotReplay, isSyncStateType, replayStamps, scanCovers, scanSyncGroups, scanSyncHistory,
  type SyncScan, type SyncStamps,
} from '@stage-labs/client/xmtp/syncSnapshot';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { getCachedRows, setCachedRows } from './channelsCache';
import { applyRemotePinState, loadPinnedOrder } from './pins';
import { applyRemoteClearedChats, ensureClearedChatsLoaded, getClearedChats } from './clearedChats';
import { applyRemoteBoardOrder, loadBoardOrder } from './boardOrder';
import { applyRemoteLabels, loadLabelEntries } from './labelRegistry';
import {
  isHiddenConv, onBoardOrderChanged, onClearedChatsChanged, onLabelRegistryChanged, onPinChanged, onReadStateChanged,
  registerHiddenConv, type BoardOrderChange, type LabelRegistryChange, type PinChange, type ReadStateChange,
} from './readSyncRegistry';
import {
  buildSyncSnapshot, clearChangeCounter, countSyncMessage, loadChangeCounter, resetChangeCounter, syncSnapshotDue,
} from './readSyncSnapshot';
import { makeSyncStampsStore } from './readSyncStamps.core';
import { rowIdOfConv } from './xmtp.conv';
import { xmtpSendJson } from './xmtp.messages';
import { createSyncGroup, isOwnSyncGroup, listSyncGroups, syncConversation, syncMessagesPage } from './xmtp.readSync';
import { applyRemoteReadStates } from './xmtp.unread';
import { waitForXmtpReady } from './xmtp.state';
import { subscribeAllMessages } from './xmtp.stream';
import { lineOfConv, type StreamMsg } from './xmtp.types';
import {
  BOARD_STATE_CODEC, CLEAR_STATE_CODEC, LABEL_STATE_CODEC, PIN_STATE_CODEC, READ_STATE_CODEC, SYNC_SNAPSHOT_CODEC,
  type JsonCodec,
} from './xmtpJsonCodecs';
import { report, reported, recover, ignored } from './errorPolicy';

const CURSOR_PREFIX = 'readSync.cursor.';
const CLEARED_KEY = 'cleared';
const PUBLISH_DEBOUNCE_MS = 800;

let started = false;
let bootToken = 0;
let groupId: string | null = null;
const localAt = new Map<string, number>();
const pendingPublish = new Map<string, ReturnType<typeof setTimeout>>();
const nudgedFrom = new Set<string>();
const seenReads = new Set<string>();
const stamps = makeSyncStampsStore({
  get: (key) => appStorage.get(key),
  save: (key, raw) => { appStorage.set(key, raw).catch(ignored(undefined, 'cache')); },
});
let known: SyncGroupRef[] = [];
let covered: string[] = [];
let posting = false;

function readKey(convId: string): string { return `read:${convId}`; }
function pinKey(convId: string): string { return `pin:${convId}`; }
const PIN_ORDER_KEY = 'pinOrder';
const BOARD_ORDER_KEY = 'boardOrder';
const LABELS_KEY = 'labels';

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
  for (const state of reads) seenReads.add(state.convId);
  const applied = await applyRemoteReadStates(reads);
  const before = getCachedRows();
  if (!before) return;
  const rows = applied.reduce(patchedRows, before);
  if (rows !== before) setCachedRows(rows);
}

function acceptPinState(state: PinStateContent): boolean {
  if (state.order !== undefined) {
    if (!shouldApplyReadState(stamps.current().pin?.at, state.at)) return false;
    stamps.stampPin({ convId: state.convId, at: state.at });
    return true;
  }
  const key = pinKey(state.convId);
  if (!shouldApplyReadState(localAt.get(key), state.at)) return false;
  localAt.set(key, state.at);
  return true;
}

async function applyPinStates(remote: readonly PinStateContent[]): Promise<void> {
  for (const state of await Promise.all(remote.map(pinStateForRows))) {
    if (acceptPinState(state)) await applyRemotePinState(state);
  }
}

async function applyBoardState(accountId: string, state: BoardStateContent): Promise<void> {
  if (!shouldApplyReadState(stamps.current().boardAt ?? undefined, state.at)) return;
  stamps.stampBoard(state.at);
  await applyRemoteBoardOrder(accountId, state.order);
}

async function applyReplay(accountId: string, replay: SyncReplay): Promise<void> {
  await applyReadStates(replay.reads);
  await applyPinStates(replay.pins);
  if (replay.cleared !== null) await applyRemoteClearedChats(replay.cleared);
  if (replay.board !== null) await applyBoardState(accountId, replay.board);
  if (replay.labels !== null) await applyRemoteLabels(accountId, replay.labels);
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

type SyncGroupRef = Pick<SyncGroupState, 'id' | 'active'>;

interface GroupReplay extends SyncScan<StreamedMessage> {
  group: SyncGroupRef;
  cursorKey: string;
  cursor: number;
  covered: boolean;
}

const EMPTY_SCAN: SyncScan<StreamedMessage> = {
  messages: [], snapshotNs: null, covers: new Map(), floorNs: 0, reachedNs: Number.POSITIVE_INFINITY,
};

async function readGroup(accountId: string, group: SyncGroupRef, floorNs: number, seed: boolean): Promise<GroupReplay> {
  const synced = group.active && await syncConversation(group.id).then(() => true, recover('readSync.sync', false));
  const cursorKey = `${CURSOR_PREFIX}${accountId}.${group.id}`;
  const cursor = Number(await appStorage.get(cursorKey).catch(recover('readSync.cursor', null))) || 0;
  const fetchPage = (limit: number, beforeMs: number | undefined) => syncMessagesPage(group.id, limit, beforeMs);
  const scan = await scanSyncHistory(fetchPage, seed ? floorNs : Math.max(cursor, floorNs), group.id)
    .catch(recover('readSync.messages', null));
  if (scan === null) return { group, cursorKey, cursor, ...EMPTY_SCAN, covered: false };
  return { group, cursorKey, cursor, ...scan, covered: synced && scanCovers(scan, cursor) };
}

function freshMessages(b: GroupReplay): StreamedMessage[] {
  return b.messages.filter((m) => m.sentNs > b.cursor);
}

function seenStamps(batches: readonly GroupReplay[]): SyncStamps {
  const applied = batches.flatMap((b) => b.messages.filter((m) => m.sentNs <= b.cursor));
  return replayStamps(collectSnapshotReplay(applied, 0));
}

async function readSyncGroups(
  accountId: string, target: string, groups: readonly SyncGroupRef[], seed: boolean,
): Promise<GroupReplay[] | null> {
  const token = bootToken;
  const batches = await scanSyncGroups(groups.map((group) => ({ id: group.id, group })), target,
    ({ group }, floorNs) => readGroup(accountId, group, floorNs, seed));
  if (token !== bootToken) return null;
  if (seed) stamps.seed(seenStamps(batches));
  await applyReplay(accountId, collectSnapshotReplay(batches.flatMap(freshMessages), 0));
  for (const b of batches) {
    const fresh = freshMessages(b);
    const latest = fresh.reduce((max, m) => Math.max(max, m.sentNs), b.cursor);
    if (latest > b.cursor) await appStorage.set(b.cursorKey, String(latest)).catch(ignored(undefined, 'cache'));
    if (b.group.id !== target && fresh.some((m) => isSyncStateType(m.contentTypeId))) nudgeFrom(b.group.id);
  }
  return batches;
}

function coveredIds(batches: readonly GroupReplay[]): string[] {
  return batches.filter((b) => b.covered).map((b) => b.group.id);
}

async function replay(accountId: string, target: string, groups: readonly SyncGroupRef[], seed: boolean): Promise<void> {
  const batches = await readSyncGroups(accountId, target, groups, seed);
  if (batches === null) return;
  known = [...groups];
  covered = coveredIds(batches);
  const own = batches.find((b) => b.group.id === target);
  if (own === undefined) return;
  await loadChangeCounter(accountId, target, own);
  if (syncSnapshotDue(target)) await postSyncSnapshot(target, accountId, true);
}

async function adoptStamps(accountId: string, token: number): Promise<boolean> {
  const stored = await stamps.read(accountId).catch(recover<SyncStamps | null | undefined>('readSync.stamps', undefined));
  if (token !== bootToken) return false;
  stamps.adopt(accountId, stored ?? null, stored !== undefined);
  return stored === null || stored === undefined;
}

function withTarget(groups: readonly SyncGroupRef[], target: string): SyncGroupRef[] {
  return groups.some((g) => g.id === target) ? [...groups] : [...groups, { id: target, active: true }];
}

async function boot(): Promise<void> {
  const token = ++bootToken;
  groupId = null;
  localAt.clear();
  seenReads.clear();
  stamps.clear();
  known = [];
  covered = [];
  clearChangeCounter();
  if (!(await waitForXmtpReady())) return;
  const rec = await getActiveAccount().catch(recover('readSync.boot', null));
  if (rec === null || token !== bootToken) return;
  await ensureClearedChatsLoaded();
  try {
    const seed = await adoptStamps(rec.id, token);
    const groups = await knownSyncGroups();
    const target = await chooseGroup(rec.address, groups);
    if (token === bootToken) await replay(rec.id, target, withTarget(groups, target), seed);
  } catch (err) {
    report('readSync.boot', err);
  }
}

async function withGroup(send: (groupId: string, accountId: string) => Promise<unknown>, onlyFor?: string): Promise<void> {
  try {
    const rec = await getActiveAccount();
    if (rec === null || (onlyFor !== undefined && rec.id !== onlyFor)) return;
    await send(await ensureGroup(rec.address), rec.id);
  } catch (err) {
    report('readSync.publish', err);
  }
}

async function catchUp(accountId: string, target: string): Promise<string[]> {
  const batches = await readSyncGroups(accountId, target, withTarget(known, target), false);
  if (batches === null) return [];
  covered = coveredIds(batches);
  return covered;
}

async function postSyncSnapshot(target: string, accountId: string, caughtUp = false): Promise<void> {
  if (posting || !stamps.persisting()) return;
  const token = bootToken;
  posting = true;
  try {
    const groups = caughtUp ? covered : await catchUp(accountId, target);
    if (!groups.includes(target)) return;
    const content = await buildSyncSnapshot(accountId, seenReads, stamps.current(), groups);
    if (content === null || token !== bootToken) return;
    await xmtpSendJson(lineOfConv(target), SYNC_SNAPSHOT_CODEC, content);
    resetChangeCounter(target);
  } finally {
    posting = false;
  }
}

async function snapshotIfDue(target: string, accountId: string): Promise<void> {
  if (syncSnapshotDue(target)) await postSyncSnapshot(target, accountId);
}

function publish<T>(codec: JsonCodec<T>, content: T, onlyFor?: string): void {
  void withGroup(async (id, accountId) => {
    await xmtpSendJson(lineOfConv(id), codec, content);
    await snapshotIfDue(id, accountId);
  }, onlyFor);
}

function stampBoardState(order: readonly string[]): BoardStateContent {
  const at = Date.now();
  stamps.stampBoard(at);
  return { order: [...order], at };
}

async function publishBoardSnapshot(line: string, accountId: string): Promise<void> {
  const order = await loadBoardOrder(accountId);
  if (order.length === 0) return;
  await xmtpSendJson(line, BOARD_STATE_CODEC, stampBoardState(order));
}

async function publishLabelSnapshot(line: string, accountId: string): Promise<void> {
  const labels = await loadLabelEntries(accountId);
  if (labels.length === 0) return;
  await xmtpSendJson(line, LABEL_STATE_CODEC, { labels: [...labels] });
}

async function publishPinOrder(line: string): Promise<void> {
  const order = await loadPinnedOrder();
  const first = order[0];
  if (first === undefined) return;
  const at = Date.now();
  stamps.stampPin({ convId: first, at });
  await xmtpSendJson(line, PIN_STATE_CODEC, { convId: first, pinned: true, order: [...order], at });
}

async function publishFullState(target: string, accountId: string): Promise<void> {
  const line = lineOfConv(target);
  await xmtpSendJson(line, CLEAR_STATE_CODEC, { cleared: getClearedChats() });
  await publishBoardSnapshot(line, accountId);
  await publishLabelSnapshot(line, accountId);
  await publishPinOrder(line);
  await postSyncSnapshot(target, accountId);
}

function nudgeFrom(sourceId: string): void {
  if (nudgedFrom.has(sourceId)) return;
  nudgedFrom.add(sourceId);
  groupId = null;
  void withGroup((target, accountId) => (target === sourceId ? Promise.resolve() : publishFullState(target, accountId)));
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
  seenReads.add(change.convId);
  debounce(readKey(change.convId), () => { publish(READ_STATE_CODEC, change); });
}

function queuePinPublish(change: PinChange): void {
  const at = Date.now();
  localAt.set(pinKey(change.convId), at);
  stamps.stampPin({ convId: change.convId, at });
  const content: PinStateContent = { convId: change.convId, pinned: change.pinned, order: [...change.order], at };
  debounce(PIN_ORDER_KEY, () => { publish(PIN_STATE_CODEC, content); });
}

function queueBoardPublish(change: BoardOrderChange): void {
  const content = stampBoardState(change.order);
  debounce(BOARD_ORDER_KEY, () => { publish(BOARD_STATE_CODEC, content, change.accountId); });
}

function queueLabelPublish(change: LabelRegistryChange): void {
  const content = { labels: [...change.labels] };
  debounce(LABELS_KEY, () => { publish(LABEL_STATE_CODEC, content, change.accountId); });
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
  countSyncMessage(convId, m);
  if (!stamps.loaded()) return;
  await applyReplay(accountId, collectSnapshotReplay([m], 0));
  if (groupId !== null && convId !== groupId) nudgeFrom(convId);
}

function onStreamMessage(m: StreamMsg): void {
  if (m.convId === null || !isSyncStateType(m.msg.contentTypeId)) return;
  void onStateMessage(m.convId, m.msg).catch(reported('readSync.stream'));
}

export function startReadSync(): void {
  if (started) return;
  started = true;
  onReadStateChanged(queueReadPublish);
  onPinChanged(queuePinPublish);
  onClearedChatsChanged(queueClearedPublish);
  onBoardOrderChanged(queueBoardPublish);
  onLabelRegistryChanged(queueLabelPublish);
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => { nudgedFrom.clear(); void boot(); });
  void boot();
}
