import { isRowCleared, isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { accountClient, type AccountClient } from './xmtp.account';
import { getAccountEpoch } from './accountEpoch';
import { channelAccess } from './channelVisibility';
import { loadHiddenChannels, subscribeHiddenChannels } from './hiddenChannels';
import { knownActiveAccountId } from './channelsCache';
import { loadClearedChats, subscribeClearedChats } from './clearedChats';
import { acceptedShareConsent, type ShareDestination } from '../components/share/share.model';
import { sdk } from './xmtp.sdk';

export function assertShareAccount(accountId: string, epoch: number): void {
  if (getAccountEpoch() !== epoch || knownActiveAccountId() !== accountId)
    throw new Error('Choose a channel again for the active account.');
}

async function shareConsent(accountId: string, conv: NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>) {
  const preferences = () => Promise.all([loadClearedChats(accountId), loadHiddenChannels(accountId)]);
  await preferences();
  let changed = false;
  const invalidate = (): void => {
    changed = true;
  };
  const stop = [subscribeClearedChats(invalidate), subscribeHiddenChannels(invalidate)];
  try {
    const [cleared, hidden] = await preferences();
    const consent = await sdk.consentOf(conv);
    if (changed) throw new Error('Channel preferences changed. Choose the channel again.');
    return { cleared, hidden, consent };
  } finally {
    stop.forEach((unsubscribe) => {
      unsubscribe();
    });
  }
}

export async function checkShareDestination(accountId: string, epoch: number, destination: ShareDestination): Promise<AccountClient> {
  assertShareAccount(accountId, epoch);
  const context = await accountClient(accountId);
  const conv = await sdk.findConv(context.client, destination.convId);
  context.assertCurrent();
  assertShareAccount(accountId, epoch);
  if (!conv) throw new Error('This channel is no longer available. Choose another channel.');
  const internal = sdk.isGroup(conv) && isSyncGroupName(await sdk.groupName(conv));
  const member = await channelAccess(context, conv);
  const { consent, cleared, hidden } = await shareConsent(accountId, conv);
  context.assertCurrent();
  assertShareAccount(accountId, epoch);
  const allowed = acceptedShareConsent(sdk.isGroup(conv), hidden[destination.convId]?.hidden, consent);
  if (isRowCleared(cleared, { ...destination, lastTs: destination.lastBubbleTs }))
    throw new Error('This chat was deleted. Choose another channel.');
  if (!allowed || internal || member !== 'member') throw new Error('You can only share to an accepted channel you belong to.');
  return context;
}
