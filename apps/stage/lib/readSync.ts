import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { applyRead, applyUnread, type CachedChannelRow } from '@stage-labs/client/xmtp/channelsCache';
import {
  collectSyncReplay, isSyncType, pickPublishGroup, shouldApplyReadState, syncGroupName, type BoardStateContent, type LatestKind,
  type PinStateContent, type ReadStateContent, type SyncContents, type SyncGroupState, type SyncReplay,
} from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import {
  getCachedRows, onReadStateChanged, setCachedRows, setLastReadNs, setMarkedUnreadFlag, type ReadStateChange,
} from './channelsCache';
import { applyRemotePinState, loadPinnedOrder, onPinChanged, type PinChange } from './pins';
import { applyRemoteClearedChats, getClearedChats, loadClearedChats, onClearedChatsChanged } from './clearedChats';
import { applyRemoteBoardOrder, loadBoardOrder, onBoardOrderChanged, type AccountOrderChange } from './boardOrder';
import { applyRemoteCategoryOrder, loadCategoryOrder, onCategoryOrderChanged } from './channelGroups';
import { applyRemoteSearchState, loadSearchState, onSearchStateChanged } from './searchState';
import { applyRemoteHomeView, loadHomeView, onHomeViewChanged } from './homeView';
import { conversationIsSyncGroup, rowIdOfConv } from './xmtp.conv';
import { xmtpSendJson } from './xmtp.messages';
import { convOfLine, sdk } from './xmtp.sdk';
import { waitForXmtpReady } from './xmtp.state';
import { isHiddenConv, registerHiddenConv } from './xmtp.state.core';
import { afterFirstPages } from './feedLines';
import { subscribeAllMessages } from './xmtp.stream';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { StreamMsg } from './xmtp.types';
import { SYNC_CODECS, type JsonCodec } from '@stage-labs/client/xmtp/jsonCodecs';
import { report, reported, recover, ignored } from './errorPolicy';

const CURSOR_PREFIX = 'readSync.cursor.';
const REPLAY_LIMIT = 500;
const FIRST_REPLAY_LIMIT = 5000;
const CLEARED_KEY = 'cleared';
const PUBLISH_DEBOUNCE_MS = 800;
const SEARCH_DEBOUNCE_MS = 1000;

let bootToken = 0;
let groupId: string | null = null;
const localAt = new Map<string, number>();
const pendingPublish = new Map<string, ReturnType<typeof setTimeout>>();
const nudgedFrom = new Set<string>();

function readKey(convId: string): string { return `read:${convId}`; }
function pinKey(convId: string): string { return `pin:${convId}`; }
const PIN_ORDER_KEY = 'pinOrder';

type SyncConv = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

async function listSyncGroups(): Promise<SyncGroupState[]> {
  const all = await sdk.listConvs(await sdk.client());
  const out: SyncGroupState[] = [];
  for (const conv of all) {
    if (!(await conversationIsSyncGroup(conv))) continue;
    const active = await sdk.isActive(conv).catch(recover('readSync.isActive', false));
    out.push({ id: conv.id, createdAtNs: sdk.createdAtNs(conv), active });
  }
  return out;
}

async function isOwnSyncGroup(convId: string, address: string): Promise<boolean> {
  const conv = await convOfLine(lineOfConv(convId));
  if (conv?.id !== convId || (await sdk.groupName(conv)) !== syncGroupName(address)) return false;
  const selfInboxId = (await sdk.client()).inboxId;
  return (await conv.members()).every((m) => m.inboxId === selfInboxId);
}

async function createSyncGroup(name: string): Promise<string> {
  const group = await sdk.newGroup(await sdk.client(), [], { name });
  return group.id;
}

async function requireConv(convId: string): Promise<SyncConv> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Sync conversation not found');
  return conv;
}

async function syncConversation(convId: string): Promise<void> {
  const conv = await requireConv(convId);
  await conv.sync();
}

async function recentSyncMessages(convId: string, limit: number): Promise<RowMessage[]> {
  const conv = await requireConv(convId);
  return (await sdk.messages(conv, { limit, order: 'desc' })).map(sdk.rowOf);
}

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

async function applyReplay(accountId: string, replay: SyncReplay): Promise<void> {
  await applyReadStates(replay.reads);
  await applyPinStates(replay.pins);
  if (replay.cleared !== null) await applyRemoteClearedChats(accountId, replay.cleared);
  for (const setting of LATEST_WINS) await setting.apply(accountId, replay);
}

function isStateMessage(m: RowMessage): boolean {
  return isSyncType(m.contentTypeId);
}

let groupsLoading: Promise<SyncGroupState[]> | null = null;

function knownSyncGroups(): Promise<SyncGroupState[]> {
  groupsLoading ??= (async (): Promise<SyncGroupState[]> => {
    try {
      await afterFirstPages();
      const groups = await listSyncGroups();
      for (const g of groups) registerHiddenConv(g.id);
      return groups;
    } finally {
      groupsLoading = null;
    }
  })();
  return groupsLoading;
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

function stampOrderState(key: string, order: readonly string[]): BoardStateContent {
  const at = Date.now();
  localAt.set(key, at);
  return { order: [...order], at };
}

interface LatestWins {
  start: () => void;
  apply: (accountId: string, replay: SyncReplay) => Promise<void>;
  publishTo: (line: string, accountId: string) => Promise<void>;
}

function latestWins<K extends LatestKind>(kind: K, setting: {
  onLocal: (send: (accountId: string, state: SyncContents[K]) => void) => void;
  apply: (accountId: string, state: SyncContents[K]) => Promise<void>;
  load: (accountId: string) => Promise<SyncContents[K] | null>;
  delayMs?: number;
}): LatestWins {
  const codec = SYNC_CODECS[kind];
  return {
    start: () => { setting.onLocal((accountId, state) => { debounce(kind, () => { publish(codec, state, accountId); }, setting.delayMs); }); },
    apply: async (accountId, replay) => {
      const state = replay.latest[kind];
      if (state !== null) await setting.apply(accountId, state);
    },
    publishTo: async (line, accountId) => {
      const state = await setting.load(accountId);
      if (state !== null) await xmtpSendJson(line, codec, state);
    },
  };
}

function orderWins(kind: 'board' | 'categoryOrder', setting: {
  onChanged: (cb: (change: AccountOrderChange) => void) => void;
  apply: (accountId: string, order: readonly string[]) => Promise<void>;
  load: (accountId: string) => Promise<readonly string[]>;
}): LatestWins {
  return latestWins(kind, {
    onLocal: (send) => { setting.onChanged((change) => { send(change.accountId, stampOrderState(kind, change.order)); }); },
    apply: async (accountId, state) => {
      if (!shouldApplyReadState(localAt.get(kind), state.at)) return;
      localAt.set(kind, state.at);
      await setting.apply(accountId, state.order);
    },
    load: async (accountId) => {
      const order = await setting.load(accountId);
      return order.length === 0 ? null : stampOrderState(kind, order);
    },
  });
}

const LATEST_WINS: readonly LatestWins[] = [
  orderWins('board', { onChanged: onBoardOrderChanged, apply: applyRemoteBoardOrder, load: loadBoardOrder }),
  orderWins('categoryOrder', { onChanged: onCategoryOrderChanged, apply: applyRemoteCategoryOrder, load: loadCategoryOrder }),
  latestWins('search', {
    onLocal: (send) => { onSearchStateChanged((change) => { send(change.accountId, change.state); }); },
    apply: applyRemoteSearchState, load: loadSearchState, delayMs: SEARCH_DEBOUNCE_MS,
  }),
  latestWins('homeView', {
    onLocal: (send) => { onHomeViewChanged((change) => { send(change.accountId, change.state); }); },
    apply: applyRemoteHomeView, load: loadHomeView,
  }),
];

async function publishSnapshot(target: string, accountId: string): Promise<void> {
  const line = lineOfConv(target);
  await xmtpSendJson(line, SYNC_CODECS.clear, { cleared: await loadClearedChats(accountId) });
  for (const setting of LATEST_WINS) await setting.publishTo(line, accountId);
  const order = await loadPinnedOrder();
  const first = order[0];
  if (first === undefined) return;
  const at = Date.now();
  localAt.set(PIN_ORDER_KEY, at);
  await xmtpSendJson(line, SYNC_CODECS.pin, { convId: first, pinned: true, order: [...order], at });
}

function nudgeFrom(sourceId: string): void {
  if (nudgedFrom.has(sourceId)) return;
  nudgedFrom.add(sourceId);
  groupId = null;
  void withGroup((target, accountId) => (target === sourceId ? Promise.resolve() : publishSnapshot(target, accountId)));
}

function debounce(key: string, fn: () => void, delayMs = PUBLISH_DEBOUNCE_MS): void {
  const pending = pendingPublish.get(key);
  if (pending !== undefined) clearTimeout(pending);
  pendingPublish.set(key, setTimeout(() => {
    pendingPublish.delete(key);
    fn();
  }, delayMs));
}

function queueReadPublish(change: ReadStateChange): void {
  const at = Date.now();
  localAt.set(readKey(change.convId), at);
  const content: ReadStateContent = { ...change, at };
  debounce(readKey(change.convId), () => { publish(SYNC_CODECS.read, content); });
}

function queuePinPublish(change: PinChange): void {
  const at = Date.now();
  localAt.set(pinKey(change.convId), at);
  localAt.set(PIN_ORDER_KEY, at);
  const content: PinStateContent = { convId: change.convId, pinned: change.pinned, order: [...change.order], at };
  debounce(PIN_ORDER_KEY, () => { publish(SYNC_CODECS.pin, content); });
}

function queueClearedPublish(): void {
  debounce(CLEARED_KEY, () => { publish(SYNC_CODECS.clear, { cleared: getClearedChats() }); });
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
  onReadStateChanged(queueReadPublish);
  onPinChanged(queuePinPublish);
  onClearedChatsChanged(queueClearedPublish);
  for (const setting of LATEST_WINS) setting.start();
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => { nudgedFrom.clear(); void boot(); });
  void boot();
}
