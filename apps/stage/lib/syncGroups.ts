import { isOwnSyncGroup, syncGroupName, type SyncGroupState, type SyncOwner } from '@stage-labs/client/xmtp/readState';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { convOfLine, sdk } from './xmtp.sdk';
import { recover } from './errorPolicy';

type SyncConv = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

export async function syncOwnerOf(address: string): Promise<SyncOwner> {
  return { address, inboxId: (await sdk.client()).inboxId ?? '' };
}

async function ownSyncGroupOf(conv: SyncConv, owner: SyncOwner): Promise<SyncGroupState | null> {
  const name = await sdk.groupName(conv);
  if (name !== syncGroupName(owner.address)) return null;
  const [active, members] = await Promise.all([
    sdk.isActive(conv).catch(recover('readSync.isActive', false)),
    conv.members(),
  ]);
  const group: SyncGroupState = { id: conv.id, createdAtNs: sdk.createdAtNs(conv), active };
  const memberInboxIds = members.map((m) => m.inboxId);
  return isOwnSyncGroup({ ...group, name, addedByInboxId: sdk.addedByInboxId(conv), memberInboxIds }, owner) ? group : null;
}

export async function listOwnSyncGroups(owner: SyncOwner): Promise<SyncGroupState[]> {
  const out: SyncGroupState[] = [];
  for (const conv of await sdk.listConvs(await sdk.client())) {
    const group = await ownSyncGroupOf(conv, owner).catch(recover<SyncGroupState | null>('readSync.syncGroup', null));
    if (group !== null) out.push(group);
  }
  return out;
}

export async function isOwnSyncGroupId(convId: string, owner: SyncOwner): Promise<boolean> {
  const conv = await convOfLine(lineOfConv(convId));
  return conv?.id === convId && (await ownSyncGroupOf(conv, owner)) !== null;
}

export async function createSyncGroup(owner: SyncOwner): Promise<string> {
  const group = await sdk.newGroup(await sdk.client(), [], { name: syncGroupName(owner.address) });
  return group.id;
}
