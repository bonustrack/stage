
import { getCachedXmtpClient, getOrCreateXmtpClient } from './xmtp';
import { readProfile, type SnapshotProfile } from './profile';

export interface GroupShape {
  name?: string;
  imageUrl?: string;
  description?: string;
  superAdmins?: string[];
  admins?: () => string[];
}

export async function resolveSelfAddress(): Promise<string> {
  const c = getCachedXmtpClient();
  if (c) return c.accountIdentifier?.identifier.toLowerCase() ?? '';
  const client = await getOrCreateXmtpClient('production').catch(() => null);
  return client ? (client.accountIdentifier?.identifier.toLowerCase() ?? '') : '';
}

export function computeMemberRoles(
  group: GroupShape, addrMap: Record<string, string>,
): Record<string, 'owner' | 'admin' | 'member'> {
  const superSet = new Set((group.superAdmins ?? []).map(s => s.toLowerCase()));
  const adminSet = new Set((group.admins?.() ?? []).map(a => a.toLowerCase()));
  const roles: Record<string, 'owner' | 'admin' | 'member'> = {};
  for (const [inboxId, addr] of Object.entries(addrMap)) {
    const iid = inboxId.toLowerCase();
    roles[addr] = superSet.has(iid) ? 'owner' : adminSet.has(iid) ? 'admin' : 'member';
  }
  return roles;
}

export async function resolveMemberNames(addrs: string[]): Promise<Record<string, string | null>> {
  const profiles = await Promise.all(
    addrs.map(a => readProfile(a).catch(() => null as SnapshotProfile | null)),
  );
  const next: Record<string, string | null> = {};
  for (let i = 0; i < addrs.length; i++) {
    const addr = addrs[i];
    if (addr === undefined) continue;
    const trimmed = profiles[i]?.name?.trim();
    next[addr] = trimmed !== undefined && trimmed !== '' ? trimmed : null;
  }
  return next;
}
