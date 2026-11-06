import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { collectSyncReplay, isSyncType, type SyncReplay } from '@stage-labs/client/xmtp/sync/registry';
import type { SyncGroupState } from '@stage-labs/client/xmtp/sync/group';
import { subscribeAccountEpoch } from '../accountEpoch';
import { adoptBoardCategoryOrder } from '../channelGroups';
import { backfillHiddenChannels } from '../channelVisibility';
import { accountClient, type AccountClient } from '../xmtp.account';
import { sdk } from '../xmtp.sdk';
import { waitForXmtpReady } from '../xmtp.state';
import { isAppInFront, subscribeAppInFront } from '../appInFront';
import { addOwnInstallationsToChats } from '../ownInstallations';
import { subscribeAllMessages } from '../xmtp.stream';
import type { StreamMsg } from '../xmtp.types';
import { report, reported } from '../errorPolicy';
import {
  adoptSyncGroup,
  choosePublishGroup,
  forgetPublishGroup,
  isOtherThanPublishGroup,
  listOwnSyncGroups,
  publishGroupOf,
  syncInboxOf,
  syncTarget,
  type SyncTarget,
} from './group';
import { createSyncPublisher } from './publisher';
import { replaySyncHistory, syncActiveGroups, type SyncCursor } from './replay';
import { SYNC_APP_KINDS } from './kinds';
import type { AppSyncKind, SyncSink } from './kind';

const CATCH_UP_GAP_MS = 10_000;

let bootToken = 0;
let replaying = false;
let lastCatchUpAt = 0;
const nudgedFrom = new Set<string>();

async function withGroup(send: (target: SyncTarget) => Promise<unknown>, onlyFor?: string): Promise<void> {
  const context = await accountClient(onlyFor);
  const target = await syncTarget(context, await publishGroupOf(context));
  context.assertCurrent();
  await send(target);
}

const sink: SyncSink = { publish: createSyncPublisher(), withGroup };

const CURSORS = [...new Set(SYNC_APP_KINDS.map((kind) => kind.cursor))];

async function applyKinds(accountId: string, replay: SyncReplay, kinds: readonly AppSyncKind[] = SYNC_APP_KINDS): Promise<void> {
  for (const kind of kinds) await kind.apply(accountId, replay);
}

async function publishSnapshot(target: SyncTarget, accountId: string): Promise<void> {
  for (const kind of SYNC_APP_KINDS) await kind.snapshot(target, accountId);
}

function nudgeFrom(accountId: string, sourceId: string): void {
  if (nudgedFrom.has(sourceId)) return;
  nudgedFrom.add(sourceId);
  forgetPublishGroup();
  sink.publish({
    key: `snapshot:${sourceId}`,
    accountId,
    delayMs: 0,
    send: () => withGroup((target) => (target.conv.id === sourceId ? Promise.resolve() : publishSnapshot(target, accountId)), accountId),
  });
}

function replayCursor(context: AccountClient, groups: readonly SyncGroupState[], cursor: SyncCursor): Promise<string[]> {
  const kinds = SYNC_APP_KINDS.filter((kind) => kind.cursor === cursor);
  return replaySyncHistory(context, groups, cursor, (replay) => applyKinds(context.account.id, replay, kinds));
}

async function replay(context: AccountClient, target: string, groups: readonly SyncGroupState[]): Promise<void> {
  await syncActiveGroups(context, groups);
  for (const cursor of CURSORS) {
    for (const sourceId of await replayCursor(context, groups, cursor)) if (sourceId !== target) nudgeFrom(context.account.id, sourceId);
  }
}

function republishDurable(context: AccountClient): void {
  if (!context.current()) return;
  for (const kind of SYNC_APP_KINDS) kind.republish(sink, context.account.id);
}

async function bootReplay(token: number): Promise<void> {
  if (!(await waitForXmtpReady())) return;
  if (token !== bootToken) return;
  try {
    const context = await accountClient();
    const { id } = context.account;
    await backfillHiddenChannels(id);
    context.assertCurrent();
    const groups = await listOwnSyncGroups(context);
    await replay(context, await choosePublishGroup(context, groups), groups);
    await adoptBoardCategoryOrder(id);
    void addOwnInstallationsToChats(id)
      .catch(reported('readSync.ownInstallations'))
      .then(() => {
        republishDurable(context);
      });
  } catch (err) {
    report('readSync.boot', err);
  }
}

async function boot(): Promise<void> {
  const token = ++bootToken;
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
  const groups = await listOwnSyncGroups(context);
  await replay(context, await publishGroupOf(context), groups);
  await addOwnInstallationsToChats(context.account.id).catch(reported('readSync.ownInstallations'));
  republishDurable(context);
}

function catchUpInFront(): void {
  const now = Date.now();
  if (replaying || sdk.cachedClient() === null || !isAppInFront() || now - lastCatchUpAt < CATCH_UP_GAP_MS) return;
  replaying = true;
  lastCatchUpAt = now;
  void catchUp()
    .catch(reported('readSync.catchUp'))
    .finally(() => {
      replaying = false;
    });
}

async function onStateMessage(convId: string, m: RowMessage): Promise<void> {
  const context = await accountClient();
  if (!(await adoptSyncGroup(context, convId))) return;
  await applyKinds(context.account.id, collectSyncReplay([m], 0, { inboxId: syncInboxOf(context), nowMs: Date.now() }));
  context.assertCurrent();
  if (isOtherThanPublishGroup(convId)) nudgeFrom(context.account.id, convId);
}

function onStreamMessage(m: StreamMsg): void {
  if (m.convId === null || !isSyncType(m.msg.contentTypeId)) return;
  void onStateMessage(m.convId, m.msg).catch(reported('readSync.stream'));
}

export function startReadSync(): void {
  for (const kind of SYNC_APP_KINDS) kind.watch(sink);
  subscribeAllMessages(onStreamMessage, { includeHidden: true });
  subscribeAccountEpoch(() => {
    nudgedFrom.clear();
    void boot();
  });
  subscribeAppInFront(catchUpInFront);
  void boot();
}
