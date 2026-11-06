import type { SyncContents, SyncReplay } from '@stage-labs/client/xmtp/sync/registry';
import { applyRemoteClearedChats, loadClearedChats } from './clearedChats';
import { applyRemoteHiddenChannels, loadHiddenChannels } from './sync/hiddenChannels';
import { accountClient } from './xmtp.account';
import { getActiveAccount } from './accounts';
import { reconcileHiddenConsent } from './channelVisibility';

export async function loadChatVisibility(accountId: string): Promise<SyncContents['clear']> {
  const [cleared, hidden] = await Promise.all([loadClearedChats(accountId), loadHiddenChannels(accountId)]);
  return { cleared, hidden };
}

export async function applyRemoteChatVisibility(accountId: string, replay: SyncReplay): Promise<void> {
  if (replay.clear.cleared !== null) await applyRemoteClearedChats(accountId, replay.clear.cleared);
  if (replay.clear.hidden !== null) await applyRemoteHiddenChannels(accountId, replay.clear.hidden);
  if ((await getActiveAccount())?.id === accountId) await reconcileHiddenConsent(await accountClient(accountId));
}
