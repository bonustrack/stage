/**
 * @file Pure helpers for the Group Detail composable: self-address resolution, role mapping, and member name lookup.
 */

import { getCachedXmtpClient, getOrCreateXmtpClient } from './xmtp';
import { readProfile, type SnapshotProfile } from './profile';

/** Browser-SDK group shape used for reading metadata and admin lists. */
export interface GroupShape {
  name?: string;
  imageUrl?: string;
  description?: string;
  superAdmins?: string[];
  admins?: () => string[];
}

/** Resolve the connected wallet's lowercased address from the cached or freshly-created XMTP client. */
export async function resolveSelfAddress(): Promise<string> {
  const c = getCachedXmtpClient();
  if (c) return c.accountIdentifier?.identifier.toLowerCase() ?? '';
  const client = await getOrCreateXmtpClient('production').catch(() => null);
  return client ? (client.accountIdentifier?.identifier.toLowerCase() ?? '') : '';
}

/** Map each member address to its role (owner/admin/member) from the group's super-admin and admin inbox-id sets. */
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

/** Resolve Snapshot profile display names for the given addresses (best-effort; misses become null). */
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
