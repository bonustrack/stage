import { sdk } from './xmtp.sdk';
import { accountClient, type AccountClient } from './xmtp.account';
import { loadHiddenChannels } from './hiddenChannels';
import { recover, reported } from './errorPolicy';
import { makeListeners } from './storeCore';
import { subscribeAccountEpoch } from './accountEpoch';

type Conv = NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>;
export type GroupAccess = 'checking' | 'member' | 'waiting' | 'outside';
const pending = new WeakMap<AccountClient['client'], Promise<void>>();
const accessCache = new Map<string, { context: AccountClient; access: GroupAccess }>();
const accessChanges = makeListeners();
export const subscribeChannelAccess = accessChanges.subscribe;

subscribeAccountEpoch(() => { accessCache.clear(); accessChanges.notify(); });

export function cachedChannelAccess(convId: string | undefined): GroupAccess {
  const cached = convId ? accessCache.get(convId) : undefined;
  return cached?.context.current() ? cached.access : 'checking';
}

function rememberAccess(context: AccountClient, convId: string, access: GroupAccess): GroupAccess {
  context.assertCurrent();
  accessCache.set(convId, { context, access });
  accessChanges.notify();
  return access;
}

async function membershipAccess(context: AccountClient, conv: Conv): Promise<GroupAccess> {
  if (!sdk.isGroup(conv)) return 'member';
  const members = await conv.members();
  context.assertCurrent();
  if (members.length === 0) return 'checking';
  if (!members.some(member => member.inboxId === context.client.inboxId)) return 'outside';
  const active = await sdk.isActive(conv);
  context.assertCurrent();
  return active ? 'member' : 'waiting';
}

export async function channelAccess(context: AccountClient, conv: Conv): Promise<GroupAccess> {
  const access = await membershipAccess(context, conv).catch(recover<GroupAccess>('xmtp.channelAccess', 'checking'));
  return rememberAccess(context, conv.id, access);
}

export async function checkChannelAccess(context: AccountClient, convId: string): Promise<GroupAccess> {
  const conv = await sdk.findConv(context.client, convId).catch(recover('xmtp.channelAccessConv', null));
  return conv ? channelAccess(context, conv) : rememberAccess(context, convId, 'checking');
}

async function reconcileChannel(context: AccountClient, id: string): Promise<void> {
  const conv = await sdk.findConv(context.client, id);
  if (!conv || !sdk.isGroup(conv)) return;
  const previous = await sdk.consentOf(conv);
  const state = (await loadHiddenChannels(context.account.id))[id];
  context.assertCurrent();
  if (!state) return;
  const consent = state.hidden ? 'denied' : 'allowed';
  if (previous === consent) return;
  await sdk.setConsent(conv, consent);
  if (state.hidden || await channelAccess(context, conv) !== 'member') return;
  if ((await loadHiddenChannels(context.account.id))[id]?.hidden) return;
  context.assertCurrent();
  await conv.sync();
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
  pending.set(context.client, result.catch(reported('xmtp.hiddenConsent')));
  return result;
}

export async function syncVisibleChannels(): Promise<void> {
  const context = await accountClient();
  await reconcileHiddenConsent(context);
  context.assertCurrent();
  await sdk.syncVisible(context.client);
  await reconcileHiddenConsent(context);
}
