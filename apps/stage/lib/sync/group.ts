import {
  isOwnSyncGroup,
  isSyncGroupName,
  pickPublishGroup,
  syncGroupName,
  type SyncGroupState,
  type SyncOwner,
} from '@stage-labs/client/xmtp/sync/group';
import type { JsonCodec } from '@stage-labs/client/xmtp/jsonCodec';
import { sdk } from '../xmtp.sdk';
import type { AccountClient } from '../xmtp.account';
import { subscribeAccountEpoch } from '../accountEpoch';
import { afterFirstPages } from '../feed/lines';
import { recover } from '../errorPolicy';

type SyncConv = NonNullable<Awaited<ReturnType<typeof sdk.findConv>>>;

const syncConvIds = new Set<string>();
const trustedGroups = new Set<string>();
let groupAccountId: string | null = null;
let groupId: string | null = null;

subscribeAccountEpoch(() => {
  syncConvIds.clear();
  trustedGroups.clear();
  groupAccountId = null;
  groupId = null;
});

export function isKnownSyncConv(convId: string | null | undefined): boolean {
  return convId !== null && convId !== undefined && syncConvIds.has(convId);
}

export async function isSyncConv(conv: SyncConv): Promise<boolean> {
  const named = isSyncGroupName(await sdk.groupName(conv));
  if (named) syncConvIds.add(conv.id);
  return named;
}

function trust(id: string): void {
  trustedGroups.add(id);
  syncConvIds.add(id);
}

function ownerOf(context: AccountClient): SyncOwner {
  return { address: context.account.address, inboxId: context.client.inboxId ?? '' };
}

export function syncInboxOf(context: AccountClient): string {
  return ownerOf(context).inboxId;
}

async function ownSyncGroupOf(conv: SyncConv, owner: SyncOwner): Promise<SyncGroupState | null> {
  const name = await sdk.groupName(conv);
  if (name !== syncGroupName(owner.address)) return null;
  const [active, members] = await Promise.all([sdk.isActive(conv).catch(recover('readSync.isActive', false)), conv.members()]);
  const group: SyncGroupState = { id: conv.id, createdAtNs: sdk.createdAtNs(conv), active };
  const memberInboxIds = members.map((m) => m.inboxId);
  return isOwnSyncGroup({ ...group, name, addedByInboxId: sdk.addedByInboxId(conv), memberInboxIds }, owner) ? group : null;
}

export async function listOwnSyncGroups(context: AccountClient): Promise<SyncGroupState[]> {
  await afterFirstPages();
  context.assertCurrent();
  const owner = ownerOf(context);
  const groups: SyncGroupState[] = [];
  for (const conv of await sdk.listConvs(context.client)) {
    const group = await ownSyncGroupOf(conv, owner).catch(recover<SyncGroupState | null>('readSync.syncGroup', null));
    if (group !== null) groups.push(group);
  }
  context.assertCurrent();
  for (const group of groups) trust(group.id);
  return groups;
}

export async function choosePublishGroup(context: AccountClient, groups: readonly SyncGroupState[]): Promise<string> {
  context.assertCurrent();
  const chosen = pickPublishGroup(groups);
  const id = chosen === null ? (await sdk.newGroup(context.client, [], { name: syncGroupName(context.account.address) })).id : chosen.id;
  context.assertCurrent();
  trust(id);
  groupId = id;
  groupAccountId = context.account.id;
  return id;
}

export async function publishGroupOf(context: AccountClient): Promise<string> {
  context.assertCurrent();
  if (groupAccountId === context.account.id && groupId) return groupId;
  return choosePublishGroup(context, await listOwnSyncGroups(context));
}

export function isOtherThanPublishGroup(convId: string): boolean {
  return groupId !== null && convId !== groupId;
}

export function forgetPublishGroup(): void {
  groupId = null;
}

export async function adoptSyncGroup(context: AccountClient, convId: string): Promise<boolean> {
  const known = groupAccountId === context.account.id && trustedGroups.has(convId);
  if (!known) {
    const conv = await sdk.findConv(context.client, convId);
    if (conv?.id !== convId || (await ownSyncGroupOf(conv, ownerOf(context))) === null) return false;
  }
  context.assertCurrent();
  trust(convId);
  return true;
}

export interface SyncTarget {
  context: AccountClient;
  conv: SyncConv;
}

export async function syncTarget(context: AccountClient, convId: string): Promise<SyncTarget> {
  const conv = await sdk.findConv(context.client, convId);
  context.assertCurrent();
  if (!conv) throw new Error('Sync conversation not found');
  return { context, conv };
}

export function sendSyncState<T>({ context, conv }: SyncTarget, codec: JsonCodec<T>, content: T): Promise<string> {
  context.assertCurrent();
  return sdk.send.json(conv, codec, content);
}
