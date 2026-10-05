import {
  collectSyncReplay, isSyncType, type SyncGroupState, type SyncReplay,
} from '@stage-labs/client/xmtp/readState';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { appStorage } from '../platform/storage';
import type { AccountClient } from './xmtp.account';
import { syncTarget } from './syncTarget';
import { sdk } from './xmtp.sdk';
import { ignored, reported } from './errorPolicy';

const CURSOR_PREFIX = 'readSync.cursor.v3.';
const REPLAY_LIMIT = 5000;
interface GroupReplay { id: string; cursorKey: string; cursor: number; messages: RowMessage[] }

async function readGroup(context: AccountClient, group: SyncGroupState): Promise<GroupReplay> {
  const { conv } = await syncTarget(context, group.id);
  if (group.active) await conv.sync().catch(reported('readSync.sync'));
  const cursorKey = `${CURSOR_PREFIX}${context.account.id}.${group.id}`;
  const cursor = Number(await appStorage.get(cursorKey)) || 0;
  context.assertCurrent();
  const after = cursor > 0 ? { afterNs: cursor } : {};
  const messages = (await sdk.messages(conv, { limit: REPLAY_LIMIT, order: 'desc', ...after })).map(sdk.rowOf);
  context.assertCurrent();
  return { id: group.id, cursorKey, cursor, messages: messages.filter((m) => m.sentNs > cursor) };
}

export async function replaySyncGroups(
  context: AccountClient, target: string, groups: readonly SyncGroupState[],
  apply: (replay: SyncReplay) => Promise<void>, nudge: (id: string) => void,
): Promise<void> {
  const batches: GroupReplay[] = [];
  for (const group of groups) batches.push(await readGroup(context, group));
  context.assertCurrent();
  await apply(collectSyncReplay(batches.flatMap(b => b.messages), 0, { inboxId: context.client.inboxId ?? '', nowMs: Date.now() }));
  for (const b of batches) {
    context.assertCurrent();
    const latest = b.messages.reduce((max, m) => Math.max(max, m.sentNs), b.cursor);
    if (latest > b.cursor) await appStorage.set(b.cursorKey, String(latest)).catch(ignored(undefined, 'cache'));
    if (b.id !== target && b.messages.some(m => isSyncType(m.contentTypeId))) nudge(b.id);
  }
}
