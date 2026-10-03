import type { ChannelMemberRole } from '../channel/channel.parts.model';
import { includesKey, type ListEdits } from './SidebarSection.model';
import { compareNames } from '../../lib/format';

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

export function assignedEntries(entries: MemberListEntry[], assigned: readonly string[]): MemberListEntry[] {
  const selected = new Set(assigned.map(address => address.toLowerCase()));
  return entries.filter(entry => selected.has(entry.address.toLowerCase()));
}

export function memberAdminMark(role: ChannelMemberRole): MemberAdminMark | undefined {
  if (role === 'owner') return { role: 'superAdmin', label: 'Super admin' };
  if (role === 'admin') return { role: 'admin', label: 'Admin' };
  return undefined;
}

function compareEntries(a: MemberListEntry, b: MemberListEntry): number {
  if (a.named !== b.named) return a.named ? -1 : 1;
  const byName = compareNames(a.name, b.name);
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

export function memberChanges(members: readonly string[], wanted: ListEdits): ListEdits {
  return {
    added: wanted.added.filter(address => !includesKey(members, address)),
    removed: wanted.removed.filter(address => includesKey(members, address)),
  };
}

function countText(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

export function memberEditsText(edits: ListEdits): string {
  const parts: string[] = [];
  if (edits.added.length > 0) parts.push(countText(edits.added.length, 'Member added', 'members added'));
  if (edits.removed.length > 0) parts.push(countText(edits.removed.length, 'Member removed', 'members removed'));
  return parts.join('. ');
}
