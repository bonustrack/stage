import { sdk } from './xmtp.sdk';
import { accountClient, type AccountClient } from './xmtp.account';
import { loadHiddenChannels } from './hiddenChannels';
import { recover, report } from './errorPolicy';
import { AccountChangedError } from './xmtp.client.core';
import { makeListeners } from './storeCore';
import { subscribeAccountEpoch } from './accountEpoch';

type Conv = NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>;
export type GroupAccess = 'checking' | 'member' | 'waiting' | 'outside';
const pending = new WeakMap<AccountClient['client'], Promise<void>>();
const accessCache = new Map<string, { context: AccountClient; access: GroupAccess }>();
const accessChecks = new Map<string, symbol>();
const accessChanges = makeListeners();
export const subscribeChannelAccess = accessChanges.subscribe;

subscribeAccountEpoch(() => { accessCache.clear(); accessChecks.clear(); accessChanges.notify(); });

export function cachedChannelAccess(convId: string | undefined): GroupAccess {
  const cached = convId ? accessCache.get(convId.toLowerCase()) : undefined;
  return cached?.context.current() ? cached.access : 'checking';
}

export function rememberChannelMember(context: AccountClient, convId: string): void {
  const id = convId.toLowerCase();
  accessChecks.delete(id);
  accessCache.set(id, { context, access: 'member' });
  accessChanges.notify();
}

export function forgetChannelAccess(convId: string): void {
  accessCache.delete(convId.toLowerCase());
  accessChecks.delete(convId.toLowerCase());
  accessChanges.notify();
}

async function resolveAccess(context: AccountClient, convId: string, read: () => Promise<GroupAccess>): Promise<GroupAccess> {
  context.assertCurrent();
  const id = convId.toLowerCase();
  const check = Symbol();
  accessChecks.set(id, check);
  let access: GroupAccess = 'checking';
  try {
    access = await read();
  } finally {
    context.assertCurrent();
    if (accessChecks.get(id) === check) {
      accessChecks.delete(id);
      accessCache.set(id, { context, access });
      accessChanges.notify();
    }
  }
  return cachedChannelAccess(id);
}

async function membershipAccess(context: AccountClient, conv: Conv): Promise<GroupAccess> {
  if (!sdk.isGroup(conv)) return 'member';
  const members = await conv.members().catch(recover('xmtp.channelMembers', []));
  context.assertCurrent();
  if (members.length === 0) return 'checking';
  if (!members.some(member => member.inboxId === context.client.inboxId)) return 'outside';
  const active = await sdk.isActive(conv);
  context.assertCurrent();
  return active ? 'member' : 'waiting';
}

export function channelAccess(context: AccountClient, conv: Conv): Promise<GroupAccess> {
  return resolveAccess(context, conv.id, () => membershipAccess(context, conv));
}

export function checkChannelAccess(context: AccountClient, convId: string): Promise<GroupAccess> {
  return resolveAccess(context, convId, async () => {
    const conv = await sdk.findConv(context.client, convId);
    return conv ? membershipAccess(context, conv) : 'checking';
  });
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
  pending.set(context.client, result.catch((error: unknown) => {
    if (!(error instanceof AccountChangedError)) report('xmtp.hiddenConsent', error);
  }));
  return result;
}

export async function syncVisibleChannels(): Promise<void> {
  const context = await accountClient();
  await reconcileHiddenConsent(context);
  context.assertCurrent();
  await sdk.syncVisible(context.client);
  await reconcileHiddenConsent(context);
}
