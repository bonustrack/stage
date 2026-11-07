import { isRowCleared } from '@stage-labs/client/xmtp/sync/clear';
import { accountClient, type AccountClient } from './xmtp.account';
import { channelAccess } from './channelAccess';
import { loadHiddenChannels, subscribeHiddenChannels } from './sync/hiddenChannels';
import type { AccountScope } from './accountSelection';
import { loadClearedChats, subscribeClearedChats } from './sync/clearedChats';
import { acceptedShareConsent, type ShareDestination } from './shareDestination.model';
import { sdk } from './xmtp.sdk';
import { isSyncConv } from './sync/group';

export type ShareScope = AccountScope & { accountId: string };

export function isShareScope(scope: AccountScope): scope is ShareScope {
  return scope.accountId !== null;
}

const SHARE_ACCOUNT_CHANGED = 'Choose a channel again for the active account.';

function shareContext(context: AccountClient, scope: ShareScope): AccountClient {
  return {
    ...context,
    current: () => context.current() && scope.current(),
    assertCurrent: () => {
      context.assertCurrent();
      scope.assertCurrent(SHARE_ACCOUNT_CHANGED);
    },
  };
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

export async function checkShareDestination(scope: ShareScope, destination: ShareDestination): Promise<AccountClient> {
  scope.assertCurrent(SHARE_ACCOUNT_CHANGED);
  const context = shareContext(await accountClient(scope.accountId), scope);
  const conv = await sdk.findConv(context.client, destination.convId);
  context.assertCurrent();
  if (!conv) throw new Error('This channel is no longer available. Choose another channel.');
  const internal = sdk.isGroup(conv) && (await isSyncConv(conv));
  const member = await channelAccess(context, conv);
  const { consent, cleared, hidden } = await shareConsent(scope.accountId, conv);
  context.assertCurrent();
  const allowed = acceptedShareConsent(sdk.isGroup(conv), hidden[destination.convId]?.hidden, consent);
  if (isRowCleared(cleared, { ...destination, lastTs: destination.lastBubbleTs }))
    throw new Error('This chat was deleted. Choose another channel.');
  if (!allowed || internal || member !== 'member') throw new Error('You can only share to an accepted channel you belong to.');
  return context;
}
