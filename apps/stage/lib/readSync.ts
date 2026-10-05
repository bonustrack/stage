import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { applyReadUpTo, applyUnread, type CachedChannelRow } from '@stage-labs/client/xmtp/channelsCache';
import {
  collectSyncReplay, isSyncType, pickPublishGroup, shouldApplyReadState, type BoardStateContent, type LatestKind,
  type PinStateContent, type ReadStateContent, type SyncContents, type SyncGroupState, type SyncOwner, type SyncReplay,
  type SyncTrust,
} from '@stage-labs/client/xmtp/readState';
import { replaySyncGroups } from './readSyncReplay';
import { syncTarget, sendSyncState, type SyncTarget } from './syncTarget';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import {
  getCachedRows, getLastReadNs, onReadStateChanged, setCachedRows, setLastReadNs, setMarkedUnreadFlag, type ReadStateChange,
} from './channelsCache';
import { applyRemotePinState, loadPinnedOrder, onPinChanged, type PinChange } from './pins';
import { onClearedChatsChanged } from './clearedChats';
import { onHiddenChannelsChanged } from './hiddenChannels';
import { applyRemoteChatVisibility, backfillHiddenChannels, loadChatVisibility } from './chatVisibility';
import { applyRemoteBoardOrder, loadBoardOrder, onBoardOrderChanged, type AccountOrderChange } from './boardOrder';
import { adoptBoardCategoryOrder, applyRemoteCategoryOrder, loadCategoryOrder, onCategoryOrderChanged } from './channelGroups';
import { applyRemoteSearchState, loadSearchState, onSearchStateChanged } from './searchState';
import { applyRemoteHomeView, loadHomeView, onHomeViewChanged } from './homeView';
import { rowIdOfConv } from './xmtp.conv';
import { accountClient, type AccountClient } from './xmtp.account';
import { createVisibilityPublisher } from './pendingVisibility';
import { sdk } from './xmtp.sdk';
import { waitForXmtpReady } from './xmtp.state';
import { isAppInFront, subscribeAppInFront } from './appInFront';
import { addOwnInstallationsToChats } from './ownInstallations';
import { createSyncGroup, isOwnSyncGroupId, listOwnSyncGroups } from './syncGroups';
import { registerHiddenConv } from './xmtp.state.core';
import { afterFirstPages } from './feedLines';
import { subscribeAllMessages } from './xmtp.stream';
import type { StreamMsg } from './xmtp.types';
import { SYNC_CODECS, type JsonCodec } from '@stage-labs/client/xmtp/jsonCodecs';
import { report, reported } from './errorPolicy';
const CATCH_UP_GAP_MS = 10_000;
const PUBLISH_DEBOUNCE_MS = 800;
const SEARCH_DEBOUNCE_MS = 1000;

let bootToken = 0;
let replaying = false;
let lastCatchUpAt = 0;
let groupId: string | null = null;
let groupAccountId: string | null = null;
const ownGroups = new Set<string>();
const localAt = new Map<string, number>();
const pendingPublish = new Map<string, ReturnType<typeof setTimeout>>();
const nudgedFrom = new Set<string>();

function readKey(convId: string): string { return `read:${convId}`; }
function pinKey(convId: string): string { return `pin:${convId}`; }
const PIN_ORDER_KEY = 'pinOrder';

function trustFor(owner: SyncOwner): SyncTrust {
  return { inboxId: owner.inboxId, nowMs: Date.now() };
}

function trustGroup(id: string): void {
  ownGroups.add(id);
  registerHiddenConv(id);
}

function ownerOf(context: AccountClient): SyncOwner {
  return { address: context.account.address, inboxId: context.client.inboxId ?? '' };
}

function patchedRows<R extends CachedChannelRow>(rows: R[], state: ReadStateContent): R[] {
  const next = state.markedUnread ? applyUnread(rows, state.convId) : applyReadUpTo(rows, state.convId, state.lastReadNs);
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
  const applied: ReadStateContent[] = [];
  for (const state of reads) {
    if (!shouldApplyReadState(localAt.get(readKey(state.convId)), state.at)) continue;
    localAt.set(readKey(state.convId), state.at);
    await setLastReadNs(state.convId, Math.max(await getLastReadNs(state.convId), state.lastReadNs));
    await setMarkedUnreadFlag(state.convId, state.markedUnread);
    applied.push(state);
  }
  const rows = getCachedRows();
  if (!rows) return;
  const next = applied.reduce(patchedRows, rows);
  if (next !== rows) setCachedRows(next);
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
  await applyRemoteChatVisibility(accountId, replay);
  for (const setting of LATEST_WINS) await setting.apply(accountId, replay);
}

function isStateMessage(m: RowMessage): boolean {
  return isSyncType(m.contentTypeId);
}

async function knownSyncGroups(context: AccountClient): Promise<SyncGroupState[]> {
  await afterFirstPages();
  context.assertCurrent();
  const groups = await listOwnSyncGroups(ownerOf(context), context.client);
  context.assertCurrent();
  for (const g of groups) trustGroup(g.id);
  return groups;
}

async function chooseGroup(context: AccountClient, groups: readonly SyncGroupState[]): Promise<string> {
  context.assertCurrent();
  const chosen = pickPublishGroup(groups);
  const id = chosen === null ? await createSyncGroup(ownerOf(context), context.client) : chosen.id;
  context.assertCurrent();
  trustGroup(id);
  groupId = id;
  groupAccountId = context.account.id;
  return id;
}

async function ensureGroup(context: AccountClient): Promise<string> {
  context.assertCurrent();
  return groupAccountId === context.account.id && groupId ? groupId : chooseGroup(context, await knownSyncGroups(context));
}

function replay(context: AccountClient, target: string, groups: readonly SyncGroupState[]): Promise<void> {
  return replaySyncGroups(context, target, groups, state => applyReplay(context.account.id, state), nudgeFrom);
}

async function bootReplay(token: number): Promise<void> {
  if (!(await waitForXmtpReady())) return;
  if (token !== bootToken) return;
  try {
    const context = await accountClient();
    const { id } = context.account;
    await backfillHiddenChannels(id);
    context.assertCurrent();
    const groups = await knownSyncGroups(context);
    const target = await chooseGroup(context, groups);
    await replay(context, target, groups);
    await adoptBoardCategoryOrder(id);
    void addOwnInstallationsToChats(id).catch(reported('readSync.ownInstallations'))
      .then(() => { if (context.current()) queueClearedPublish(id); });
  } catch (err) {
    report('readSync.boot', err);
  }
}

async function boot(): Promise<void> {
  const token = ++bootToken;
  groupId = null;
  ownGroups.clear();
  localAt.clear();
  replaying = true;
  try {
    await bootReplay(token);
  } finally {
    if (token === bootToken) replaying = false;
  }
}

async function catchUp(): Promise<void> {
  const context = await accountClient();
  await backfillHiddenChannels(context.account.id);
  const groups = await knownSyncGroups(context);
  await replay(context, await ensureGroup(context), groups);
  await addOwnInstallationsToChats(context.account.id);
  context.assertCurrent();
  queueClearedPublish(context.account.id);
}

function catchUpInFront(): void {
  const now = Date.now();
  if (replaying || sdk.cachedClient() === null || !isAppInFront() || now - lastCatchUpAt < CATCH_UP_GAP_MS) return;
  replaying = true;
  lastCatchUpAt = now;
  void catchUp().catch(reported('readSync.catchUp')).finally(() => { replaying = false; });
}

async function withGroup(
  send: (target: SyncTarget, accountId: string) => Promise<unknown>, onlyFor?: string,
): Promise<boolean> {
  const context = await accountClient(onlyFor);
  const target = await syncTarget(context, await ensureGroup(context));
  context.assertCurrent();
  await send(target, context.account.id);
  return true;
}

function publish<T>(codec: JsonCodec<T>, content: T, onlyFor?: string): void {
  void withGroup((target) => sendSyncState(target, codec, content), onlyFor).catch(reported('readSync.publish'));
}

function stampOrderState(key: string, order: readonly string[]): BoardStateContent {
  const at = Date.now();
  localAt.set(key, at);
  return { order: [...order], at };
}

interface LatestWins {
  start: () => void;
  apply: (accountId: string, replay: SyncReplay) => Promise<void>;
  publishTo: (target: SyncTarget, accountId: string) => Promise<void>;
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
    publishTo: async (target, accountId) => {
      const state = await setting.load(accountId);
      if (state !== null) await sendSyncState(target, codec, state);
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

async function publishSnapshot(target: SyncTarget, accountId: string): Promise<void> {
  await sendSyncState(target, SYNC_CODECS.clear, await loadChatVisibility(accountId));
  for (const setting of LATEST_WINS) await setting.publishTo(target, accountId);
  const order = await loadPinnedOrder();
  const first = order[0];
  if (first === undefined) return;
  const at = Date.now();
  localAt.set(PIN_ORDER_KEY, at);
  await sendSyncState(target, SYNC_CODECS.pin, { convId: first, pinned: true, order: [...order], at });
}

function nudgeFrom(sourceId: string): void {
  if (nudgedFrom.has(sourceId)) return;
  nudgedFrom.add(sourceId);
  groupId = null;
  void withGroup((target, accountId) => (target.conv.id === sourceId ? Promise.resolve() : publishSnapshot(target, accountId)))
    .catch(reported('readSync.snapshot'));
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

const queueClearedPublish = createVisibilityPublisher((accountId) => withGroup(async (target) =>
  sendSyncState(target, SYNC_CODECS.clear, await loadChatVisibility(accountId)), accountId));

interface Adopted { context: AccountClient; owner: SyncOwner }

async function adoptSyncGroup(convId: string): Promise<Adopted | null> {
  const context = await accountClient();
  const owner = ownerOf(context);
  if (!(groupAccountId === context.account.id && ownGroups.has(convId)) && !(await isOwnSyncGroupId(convId, owner, context.client))) return null;
  context.assertCurrent();
  trustGroup(convId);
  return { context, owner };
}

async function onStateMessage(convId: string, m: RowMessage): Promise<void> {
  const adopted = await adoptSyncGroup(convId);
  if (adopted === null) return;
  await applyReplay(adopted.context.account.id, collectSyncReplay([m], 0, trustFor(adopted.owner)));
  adopted.context.assertCurrent();
  if (groupId !== null && convId !== groupId) nudgeFrom(convId);
}

function onStreamMessage(m: StreamMsg): void {
  if (m.convId === null || !isStateMessage(m.msg)) return;
  void onStateMessage(m.convId, m.msg).catch(reported('readSync.stream'));
}

export function startReadSync(): void {
  onReadStateChanged(queueReadPublish);
  onPinChanged(queuePinPublish);
  onClearedChatsChanged(() => { void getActiveAccount().then(rec => { if (rec) queueClearedPublish(rec.id); }).catch(reported('readSync.clear')); });
  onHiddenChannelsChanged(queueClearedPublish);
  for (const setting of LATEST_WINS) setting.start();
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => { nudgedFrom.clear(); void boot(); });
  subscribeAppInFront(catchUpInFront);
  void boot();
}
