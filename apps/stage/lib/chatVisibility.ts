import { isSyncGroupName, type HiddenChannels, type SyncContents, type SyncReplay } from '@stage-labs/client/xmtp/readState';
import { applyRemoteClearedChats, loadClearedChats } from './clearedChats';
import { applyRemoteHiddenChannels, loadHiddenChannels } from './hiddenChannels';
import { sdk } from './xmtp.sdk';
import { accountClient } from './xmtp.account';
import { getActiveAccount } from './accounts';
import { reconcileHiddenConsent } from './channelVisibility';

export async function loadChatVisibility(accountId: string): Promise<SyncContents['clear']> {
  const [cleared, hidden] = await Promise.all([loadClearedChats(accountId), loadHiddenChannels(accountId)]);
  return { cleared, hidden };
}

export async function applyRemoteChatVisibility(accountId: string, replay: SyncReplay): Promise<void> {
  if (replay.cleared !== null) await applyRemoteClearedChats(accountId, replay.cleared);
  if (replay.hidden !== null) await applyRemoteHiddenChannels(accountId, replay.hidden);
  if ((await getActiveAccount())?.id === accountId) await reconcileHiddenConsent(await accountClient(accountId));
}

export async function backfillHiddenChannels(accountId: string): Promise<void> {
  const context = await accountClient(accountId);
  await context.client.preferences.sync();
  context.assertCurrent();
  const hidden: HiddenChannels = {};
  for (const conv of await sdk.listConvs(context.client, ['denied'])) {
    if (!sdk.isGroup(conv) || isSyncGroupName(await sdk.groupName(conv))) continue;
    hidden[conv.id] = { hidden: true, at: 0 };
  }
  context.assertCurrent();
  await applyRemoteHiddenChannels(accountId, hidden);
  await reconcileHiddenConsent(context);
}
