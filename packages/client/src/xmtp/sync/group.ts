const SYNC_GROUP_PREFIX = 'stage.sync:';

export function syncGroupName(address: string): string {
  return `${SYNC_GROUP_PREFIX}${address.toLowerCase()}`;
}

export function isSyncGroupName(name: unknown): boolean {
  return typeof name === 'string' && name.startsWith(SYNC_GROUP_PREFIX);
}

export interface SyncGroupState {
  id: string;
  createdAtNs: number;
  active: boolean;
}

export interface SyncOwner {
  address: string;
  inboxId: string;
}

export interface SyncGroupFacts extends SyncGroupState {
  name: string | undefined;
  addedByInboxId: string | undefined;
  memberInboxIds: readonly string[];
}

export function isOwnSyncGroup(group: SyncGroupFacts, owner: SyncOwner): boolean {
  if (owner.inboxId === '' || group.name !== syncGroupName(owner.address)) return false;
  if (group.addedByInboxId !== owner.inboxId) return false;
  if (group.active && group.memberInboxIds.length === 0) return false;
  return group.memberInboxIds.every((id) => id === owner.inboxId);
}

export function pickPublishGroup<T extends SyncGroupState>(groups: readonly T[]): T | null {
  const active = groups.filter((g) => g.active).sort((a, b) => a.id.localeCompare(b.id));
  return active[0] ?? null;
}
