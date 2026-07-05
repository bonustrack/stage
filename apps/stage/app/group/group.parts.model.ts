export type GroupMemberRole = 'owner' | 'admin' | 'member' | undefined;

export interface MemberRowBadge {
  role: 'owner' | 'admin';
  label: string;
}

export interface MemberRowModel {
  displayName: string;
  addressLine?: string;
  badge?: MemberRowBadge;
}

export interface MemberRowInput {
  shortAddress: string;
  name: string | null | undefined;
  isSelf: boolean;
  role: GroupMemberRole;
}

function memberRowBadge(role: GroupMemberRole): MemberRowBadge | undefined {
  if (role === 'owner') return { role: 'owner', label: 'Owner' };
  if (role === 'admin') return { role: 'admin', label: 'Admin' };
  return undefined;
}

export function memberRowModel(input: MemberRowInput): MemberRowModel {
  const name = input.name ?? '';
  const named = name !== '';
  const base = named ? name : input.shortAddress;
  return {
    displayName: input.isSelf ? `${base} (you)` : base,
    addressLine: named ? input.shortAddress : undefined,
    badge: memberRowBadge(input.role),
  };
}
