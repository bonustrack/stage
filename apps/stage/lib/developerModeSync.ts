import { collectSyncReplay, type DeveloperModeContent, type SyncGroupState } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { applyRemoteDeveloperMode, loadDeveloperMode } from './developerMode';
import { createVisibilityPublisher } from './pendingVisibility';
import { syncTarget } from './syncTarget';
import type { AccountClient } from './xmtp.account';
import { sdk } from './xmtp.sdk';

const CURSOR_PREFIX = 'developerMode.cursor.v1.';
const PAGE_SIZE = 5000;

export function createDeveloperModePublisher(send: (accountId: string, state: DeveloperModeContent) => Promise<boolean>): (accountId: string) => void {
  return createVisibilityPublisher(async accountId => {
    const state = await loadDeveloperMode(accountId);
    return state === null || await send(accountId, state);
  });
}

function nextPage(oldest: number, cursor: number, beforeNs: number | undefined): number {
  if (oldest <= cursor || (beforeNs !== undefined && oldest >= beforeNs)) throw new Error('Developer mode history did not advance.');
  return oldest;
}

async function replayGroup(context: AccountClient, group: SyncGroupState): Promise<void> {
  const { conv } = await syncTarget(context, group.id);
  const key = `${CURSOR_PREFIX}${context.account.id}.${group.id}`;
  const cursor = Number(await appStorage.get(key)) || 0;
  let latest = cursor;
  let beforeNs: number | undefined;
  for (;;) {
    context.assertCurrent();
    const messages = (await sdk.messages(conv, { limit: PAGE_SIZE, order: 'desc', afterNs: cursor, beforeNs })).map(sdk.rowOf);
    context.assertCurrent();
    const state = collectSyncReplay(messages, cursor, { inboxId: context.client.inboxId ?? '', nowMs: Date.now() }).latest.developerMode;
    if (state !== null) await applyRemoteDeveloperMode(context.account.id, state);
    if (messages.length === 0) break;
    latest = messages.reduce((max, message) => Math.max(max, message.sentNs), latest);
    const oldest = messages.reduce((min, message) => Math.min(min, message.sentNs), Infinity);
    if (messages.length < PAGE_SIZE) break;
    beforeNs = nextPage(oldest, cursor, beforeNs);
  }
  context.assertCurrent();
  if (latest > cursor) await appStorage.set(key, String(latest));
}

export async function replayDeveloperMode(context: AccountClient, groups: readonly SyncGroupState[]): Promise<void> {
  for (const group of groups) await replayGroup(context, group);
}
