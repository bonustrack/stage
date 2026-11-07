import { sdk } from './xmtp.sdk';
import type { AccountClient } from './xmtp.account';
import { recover } from './errorPolicy';
import { makeListeners } from './storeCore';
import { subscribeAccountEpoch } from './accountEpoch';

type Conv = NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>;
export type GroupAccess = 'checking' | 'member' | 'waiting' | 'outside';
const accessCache = new Map<string, { context: AccountClient; access: GroupAccess }>();
const accessChecks = new Map<string, symbol>();
const accessChanges = makeListeners();
export const subscribeChannelAccess = accessChanges.subscribe;

subscribeAccountEpoch(() => {
  accessCache.clear();
  accessChecks.clear();
  accessChanges.notify();
});

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
  const members = await sdk.memberInboxIds(conv).catch(recover<string[]>('xmtp.channelMembers', []));
  context.assertCurrent();
  if (members.length === 0) return 'checking';
  if (!members.includes(sdk.inboxIdOf(context.client))) return 'outside';
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
