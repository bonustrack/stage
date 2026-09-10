import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { applyRead, applyUnread } from '@stage-labs/client/xmtp/channelsCache';
import {
  isReadStateType, parseReadState, pickSyncGroup, shouldApplyReadState, syncGroupName,
  type ReadStateContent,
} from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { getCachedRows, setCachedRows } from './channelsCache';
import {
  isHiddenConv, onReadStateChanged, registerHiddenConv, type ReadStateChange,
} from './readSyncRegistry';
import { setLastReadNs, setMarkedUnreadFlag } from './xmtp.client';
import {
  createSyncGroup, listSyncGroups, recentSyncMessages, sendReadState, syncConversation,
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

async function applyMessage(m: RowMessage): Promise<void> {
  if (!isReadStateType(m.contentTypeId)) return;
  const state = parseReadState(m.content);
  if (state === null || !shouldApplyReadState(localAt.get(state.convId), state.at)) return;
  localAt.set(state.convId, state.at);
  await setLastReadNs(state.convId, state.lastReadNs);
  await setMarkedUnreadFlag(state.convId, state.markedUnread);
  patchRows(state);
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

async function publish(content: ReadStateContent): Promise<void> {
  try {
    const rec = await getActiveAccount().catch(() => null);
    if (rec === null) return;
    const id = await ensureGroup(rec.address);
    await sendReadState(id, content);
  } catch (err) {
    warn('publish', err);
  }
}

function queuePublish(change: ReadStateChange): void {
  const at = Date.now();
  localAt.set(change.convId, at);
  const pending = pendingPublish.get(change.convId);
  if (pending !== undefined) clearTimeout(pending);
  pendingPublish.set(change.convId, setTimeout(() => {
    pendingPublish.delete(change.convId);
    void publish({ ...change, at });
  }, PUBLISH_DEBOUNCE_MS));
}

function onStreamMessage(m: StreamMsg): void {
  if (!isHiddenConv(m.convId)) return;
  void applyMessage(m.msg);
}

export function startReadSync(): void {
  if (started) return;
  started = true;
  onReadStateChanged(queuePublish);
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => { void boot(); });
  void boot();
}
