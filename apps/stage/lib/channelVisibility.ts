import { hiddenConsent, type HiddenChannels } from '@stage-labs/client/xmtp/sync/clear';
import { sdk } from './xmtp.sdk';
import { accountClient, type AccountClient } from './xmtp.account';
import { applyRemoteHiddenChannels, hiddenChannelsNow, isChannelHidden, isChatHidden, loadHiddenChannels } from './sync/hiddenChannels';
import { channelAccess, rememberChannelMember } from './channelAccess';
import { isKnownSyncConv, isSyncConv } from './sync/group';
import { report } from './errorPolicy';
import { AccountChangedError } from './accountSelection';
import type { XmtpConsent } from './xmtp.types';

type Conv = NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>;
const pending = new WeakMap<AccountClient['client'], Promise<void>>();
const knownConsent = new Map<string, XmtpConsent | null>();

export function channelConsent<C extends XmtpConsent | null | undefined>(
  convId: string,
  isGroup: boolean,
  consent: C,
): C | 'denied' | 'allowed' {
  return isGroup ? hiddenConsent(hiddenChannelsNow()[convId], consent) : consent;
}

export function isHiddenFromFeeds(convId: string | null | undefined): boolean {
  return isKnownSyncConv(convId) || isChannelHidden(convId);
}

export async function hiddenChannelFilter(accountId: string): Promise<(conv: Conv) => boolean> {
  const hidden = await loadHiddenChannels(accountId);
  return (conv) => isChatHidden(hidden, conv.id, sdk.isGroup(conv));
}

export function rememberConsent(convId: string, consent: XmtpConsent | null): void {
  knownConsent.set(convId, consent);
}

export function knownConsentOf(convId: string | undefined): XmtpConsent | null | undefined {
  return convId ? knownConsent.get(convId) : undefined;
}

export function rememberOwnGroup(context: AccountClient, convId: string): void {
  rememberChannelMember(context, convId);
  rememberConsent(convId, 'allowed');
}

async function reconcileChannel(context: AccountClient, id: string): Promise<void> {
  const conv = await sdk.findConv(context.client, id);
  if (!conv || !sdk.isGroup(conv)) return;
  const previous = await sdk.consentOf(conv);
  const state = (await loadHiddenChannels(context.account.id))[id];
  context.assertCurrent();
  const consent = hiddenConsent(state, previous);
  if (state === undefined || previous === consent) return;
  await sdk.setConsent(conv, consent);
  if (state.hidden || (await channelAccess(context, conv)) !== 'member') return;
  if ((await loadHiddenChannels(context.account.id))[id]?.hidden) return;
  context.assertCurrent();
  await sdk.syncConv(conv);
}

async function reconcile(context: AccountClient): Promise<void> {
  let before: string;
  do {
    const hidden = await loadHiddenChannels(context.account.id);
    before = JSON.stringify(hidden);
    for (const id of Object.keys(hidden)) {
      context.assertCurrent();
      await reconcileChannel(context, id);
    }
    context.assertCurrent();
  } while (before !== JSON.stringify(await loadHiddenChannels(context.account.id)));
}

export function reconcileHiddenConsent(context: AccountClient): Promise<void> {
  const result = (pending.get(context.client) ?? Promise.resolve()).then(() => reconcile(context));
  pending.set(
    context.client,
    result.catch((error: unknown) => {
      if (!(error instanceof AccountChangedError)) report('xmtp.hiddenConsent', error);
    }),
  );
  return result;
}

export async function syncVisibleChannels(): Promise<void> {
  const context = await accountClient();
  await reconcileHiddenConsent(context);
  context.assertCurrent();
  await sdk.syncVisible(context.client);
  await reconcileHiddenConsent(context);
}

async function deniedGroups(context: AccountClient): Promise<Conv[]> {
  const denied: Conv[] = [];
  for (const conv of await sdk.listConvs(context.client, ['denied'])) {
    if (sdk.isGroup(conv) && !(await isSyncConv(conv))) denied.push(conv);
  }
  return denied;
}

export async function backfillHiddenChannels(accountId: string): Promise<void> {
  const context = await accountClient(accountId);
  await sdk.syncPreferences(context.client);
  context.assertCurrent();
  const hidden: HiddenChannels = {};
  for (const conv of await deniedGroups(context)) hidden[conv.id] = { hidden: true, at: 0 };
  context.assertCurrent();
  await applyRemoteHiddenChannels(accountId, hidden);
  await reconcileHiddenConsent(context);
}
