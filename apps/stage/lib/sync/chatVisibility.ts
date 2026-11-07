import type { ClearReplay, ClearStateContent } from '@stage-labs/client/xmtp/sync/clear';
import { applyRemoteClearedChats, loadClearedChats, onClearedChatsChanged } from './clearedChats';
import { applyRemoteHiddenChannels, loadHiddenChannels, onHiddenChannelsChanged } from './hiddenChannels';
import { accountClient } from '../xmtp.account';
import { readActiveAccountId } from '../accountSelection';
import { reconcileHiddenConsent } from '../channelVisibility';
import { defineAppSyncKind, type KindJob } from './kind';

export async function loadChatVisibility(accountId: string): Promise<ClearStateContent> {
  const [cleared, hidden] = await Promise.all([loadClearedChats(accountId), loadHiddenChannels(accountId)]);
  return { cleared, hidden };
}

export async function applyChatVisibility(accountId: string, state: ClearReplay): Promise<void> {
  if (state.cleared !== null) await applyRemoteClearedChats(accountId, state.cleared);
  if (state.hidden !== null) await applyRemoteHiddenChannels(accountId, state.hidden);
  if ((await readActiveAccountId()) === accountId) await reconcileHiddenConsent(await accountClient(accountId));
}

function visibilityJob(accountId: string): KindJob<ClearStateContent> {
  return { key: `clear:${accountId}`, accountId, durable: true, content: () => loadChatVisibility(accountId) };
}

export const CLEAR_KIND = defineAppSyncKind({
  kind: 'clear',
  watch: (publish) => {
    const publishFor = (accountId: string): void => {
      publish(visibilityJob(accountId));
    };
    onClearedChatsChanged(publishFor);
    onHiddenChannelsChanged(publishFor);
  },
  apply: (accountId, replay) => applyChatVisibility(accountId, replay.clear),
  snapshot: loadChatVisibility,
  republish: (publish, accountId) => {
    publish(visibilityJob(accountId));
  },
});
