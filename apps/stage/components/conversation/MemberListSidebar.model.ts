import type { ChannelMemberRole } from '../channel/channel.parts.model';

type MemberAdminRole = 'superAdmin' | 'admin';

export interface MemberAdminMark {
  role: MemberAdminRole;
  label: 'Super admin' | 'Admin';
}

export interface MemberListEntry {
  address: string;
  name: string;
  named: boolean;
  admin?: MemberAdminMark;
}

export function memberAdminMark(role: ChannelMemberRole): MemberAdminMark | undefined {
  if (role === 'owner') return { role: 'superAdmin', label: 'Super admin' };
  if (role === 'admin') return { role: 'admin', label: 'Admin' };
  return undefined;
}

function compareEntries(a: MemberListEntry, b: MemberListEntry): number {
  if (a.named !== b.named) return a.named ? -1 : 1;
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return byName === 0 ? a.address.toLowerCase().localeCompare(b.address.toLowerCase()) : byName;
}

export function memberListEntries(
  addresses: string[],
  nameOf: (address: string) => string | null | undefined,
  shortOf: (address: string) => string,
  roles: Record<string, ChannelMemberRole> = {},
): MemberListEntry[] {
  const roleOf = new Map(Object.entries(roles).map(([address, role]) => [address.toLowerCase(), role]));
  const seen = new Set<string>();
  const entries: MemberListEntry[] = [];
  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = nameOf(address) ?? '';
    const entry = name === '' ? { address, name: shortOf(address), named: false } : { address, name, named: true };
    const admin = memberAdminMark(roleOf.get(key));
    entries.push(admin === undefined ? entry : { ...entry, admin });
  }
  return entries.sort(compareEntries);
}
