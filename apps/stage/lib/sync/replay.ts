import { collectSyncReplay, isSyncType, type SyncReplay } from '@stage-labs/client/xmtp/sync/registry';
import type { SyncGroupState } from '@stage-labs/client/xmtp/sync/group';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { appStorage } from '../../platform/storage';
import type { AccountClient } from '../xmtp.account';
import { sdk } from '../xmtp.sdk';
import { ignored, reported } from '../errorPolicy';
import { syncInboxOf, syncTarget, type SyncTarget } from './group';

export interface SyncCursor {
  prefix: string;
  strict: boolean;
}

export const SHARED_CURSOR: SyncCursor = { prefix: 'readSync.cursor.v4.', strict: false };

const PAGE_SIZE = 5000;

interface GroupHistory {
  id: string;
  key: string;
  cursor: number;
  messages: RowMessage[];
}

function olderPage(oldest: number, cursor: number, beforeNs: number | undefined): number {
  if (oldest <= cursor || (beforeNs !== undefined && oldest >= beforeNs)) throw new Error('Sync history did not advance.');
  return oldest;
}

async function messagesAfter({ context, conv }: SyncTarget, cursor: number): Promise<RowMessage[]> {
  const messages: RowMessage[] = [];
  let beforeNs: number | undefined;
  for (;;) {
    context.assertCurrent();
    const query = { limit: PAGE_SIZE, order: 'desc' as const, afterNs: cursor, ...(beforeNs === undefined ? {} : { beforeNs }) };
    const page = (await sdk.messages(conv, query)).map(sdk.rowOf);
    context.assertCurrent();
    messages.push(...page);
    if (page.length < PAGE_SIZE) return messages.filter((m) => m.sentNs > cursor);
    beforeNs = olderPage(
      page.reduce((min, m) => Math.min(min, m.sentNs), Infinity),
      cursor,
      beforeNs,
    );
  }
}

async function historyOf(context: AccountClient, group: SyncGroupState, cursor: SyncCursor): Promise<GroupHistory> {
  const target = await syncTarget(context, group.id);
  const key = `${cursor.prefix}${context.account.id}.${group.id}`;
  const after = Number(await appStorage.get(key)) || 0;
  return { id: group.id, key, cursor: after, messages: await messagesAfter(target, after) };
}

async function acknowledge(history: GroupHistory, cursor: SyncCursor): Promise<void> {
  const latest = history.messages.reduce((max, m) => Math.max(max, m.sentNs), history.cursor);
  if (latest <= history.cursor) return;
  const write = appStorage.set(history.key, String(latest));
  await (cursor.strict ? write : write.catch(ignored(undefined, 'cache')));
}

export async function syncActiveGroups(context: AccountClient, groups: readonly SyncGroupState[]): Promise<void> {
  for (const group of groups) {
    if (!group.active) continue;
    const { conv } = await syncTarget(context, group.id);
    await sdk.syncConv(conv).catch(reported('readSync.sync'));
  }
}

export async function replaySyncHistory(
  context: AccountClient,
  groups: readonly SyncGroupState[],
  cursor: SyncCursor,
  apply: (replay: SyncReplay) => Promise<void>,
): Promise<string[]> {
  const histories: GroupHistory[] = [];
  for (const group of groups) histories.push(await historyOf(context, group, cursor));
  context.assertCurrent();
  const messages = histories.flatMap((history) => history.messages);
  await apply(collectSyncReplay(messages, 0, { inboxId: syncInboxOf(context), nowMs: Date.now() }));
  for (const history of histories) {
    context.assertCurrent();
    await acknowledge(history, cursor);
  }
  return histories.filter((history) => history.messages.some((m) => isSyncType(m.contentTypeId))).map((history) => history.id);
}
