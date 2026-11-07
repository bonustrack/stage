import { accountClient } from './xmtp.account';
import { sdk } from './xmtp.sdk';
import { assertShareAccount } from './shareDestination';
import type { CachedRow } from './channelsCache';
import { listVisibleConversations, syncConversationsFromNetwork } from './xmtp.conv';
import { summarizeConversation } from './messaging/conversation';

const SUMMARY_BATCH = 4;

export async function fetchShareRows(accountId: string, epoch: number, network: boolean): Promise<{ rows: CachedRow[]; failed: boolean }> {
  const context = await accountClient(accountId);
  if (network) await syncConversationsFromNetwork();
  const convs = await listVisibleConversations();
  const selfInboxId = sdk.inboxIdOf(context.client);
  const rows: CachedRow[] = [];
  let failed = false;
  for (let index = 0; index < convs.length; index += SUMMARY_BATCH) {
    context.assertCurrent();
    assertShareAccount(accountId, epoch);
    const batch = await Promise.allSettled(
      convs.slice(index, index + SUMMARY_BATCH).map((conv) => summarizeConversation(conv, selfInboxId, true)),
    );
    for (const result of batch) {
      if (result.status === 'fulfilled') rows.push({ ...result.value });
      else failed = true;
    }
  }
  context.assertCurrent();
  assertShareAccount(accountId, epoch);
  return { rows, failed };
}
