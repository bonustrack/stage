
const MEMBER_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const NO_INBOX_RE = /inbox|identity|not.*regist|cannot.*find/i;
const PERMISSION_RE = /permission|admin|not.*allow|denied|unauthor/i;

export function validMemberAddresses(addresses: string[]): string[] {
  return addresses
    .map(a => a.trim())
    .filter(a => MEMBER_ADDRESS_RE.test(a));
}

export function isNoInboxError(msg: string): boolean {
  return NO_INBOX_RE.test(msg);
}

export function isPermissionError(msg: string): boolean {
  return PERMISSION_RE.test(msg);
}

export function requireValidMembers(addresses: string[]): string[] {
  const members = validMemberAddresses(addresses);
  if (members.length === 0) throw new Error('Add at least one valid member address.');
  return members;
}

function errorMessage(err: unknown): string {
  return (err as Error)?.message ?? String(err);
}

export function mapCreateGroupError(err: unknown): Error {
  const msg = errorMessage(err);
  if (isNoInboxError(msg)) {
    return new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
  }
  return new Error(`Couldn't create the group: ${msg}`);
}

export function mapAddMembersError(err: unknown): Error {
  const msg = errorMessage(err);
  if (isNoInboxError(msg)) {
    return new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
  }
  if (isPermissionError(msg)) {
    return new Error('Only a group admin can add members.');
  }
  return new Error(`Couldn't add members: ${msg}`);
}

export interface CreateGroupResult { line: string; id: string }

export async function createGroupWith(
  addresses: string[],
  lineOf: (id: string) => string,
  create: (members: string[]) => Promise<{ id: string }>,
): Promise<CreateGroupResult> {
  const members = requireValidMembers(addresses);
  try {
    const group = await create(members);
    return { line: lineOf(group.id), id: group.id };
  } catch (err) {
    throw mapCreateGroupError(err);
  }
}

export async function addGroupMembersWith(
  addresses: string[],
  add: (members: string[]) => Promise<unknown>,
): Promise<void> {
  const members = requireValidMembers(addresses);
  try {
    await add(members);
  } catch (err) {
    throw mapAddMembersError(err);
  }
}

export type GroupPolicyOption = 'allow' | 'deny' | 'admin' | 'superAdmin' | 'unknown';

export interface GroupMetaPolicy { name: GroupPolicyOption; description: GroupPolicyOption; image: GroupPolicyOption }

export type GroupRole = 'owner' | 'admin' | 'member';

export interface GroupEditRights { name: boolean; description: boolean; image: boolean }

export const UNKNOWN_GROUP_POLICY: GroupMetaPolicy = { name: 'unknown', description: 'unknown', image: 'unknown' };

const ROLE_RANK: Record<GroupRole, number> = { member: 0, admin: 1, owner: 2 };

const POLICY_RANK: Record<GroupPolicyOption, number> = {
  allow: 0, unknown: 0, admin: 1, superAdmin: 2, deny: Number.POSITIVE_INFINITY,
};

export function groupMetaPolicyOfSet(set: {
  updateGroupNamePolicy: GroupPolicyOption; updateGroupDescriptionPolicy: GroupPolicyOption; updateGroupImagePolicy: GroupPolicyOption;
}): GroupMetaPolicy {
  return { name: set.updateGroupNamePolicy, description: set.updateGroupDescriptionPolicy, image: set.updateGroupImagePolicy };
}

export function groupRoleOf(inboxId: string, staff: { admins: string[]; superAdmins: string[] }): GroupRole {
  const id = inboxId.toLowerCase();
  if (staff.superAdmins.some(s => s.toLowerCase() === id)) return 'owner';
  if (staff.admins.some(a => a.toLowerCase() === id)) return 'admin';
  return 'member';
}

function allows(policy: GroupPolicyOption, role: GroupRole): boolean {
  return ROLE_RANK[role] >= POLICY_RANK[policy];
}

export function groupEditRightsOf(policy: GroupMetaPolicy, role: GroupRole): GroupEditRights {
  return {
    name: allows(policy.name, role),
    description: allows(policy.description, role),
    image: allows(policy.image, role),
  };
}

export function canEditGroup(rights: GroupEditRights): boolean {
  return rights.name || rights.description || rights.image;
}

export function mapUpdateGroupError(err: unknown): Error {
  const msg = errorMessage(err);
  return new Error(isPermissionError(msg) ? "You don't have permission to edit this group." : msg);
}

export interface GroupMetaPatch { name?: string; imageUrl?: string; description?: string }

export interface GroupMetaWriters {
  updateName: (name: string) => Promise<unknown>;
  updateImageUrl: (imageUrl: string) => Promise<unknown>;
  updateDescription: (description: string) => Promise<unknown>;
}

export async function updateGroupMetaWith(patch: GroupMetaPatch, ops: GroupMetaWriters): Promise<void> {
  try {
    if (patch.name !== undefined) await ops.updateName(patch.name);
    if (patch.imageUrl !== undefined) await ops.updateImageUrl(patch.imageUrl);
    if (patch.description !== undefined) await ops.updateDescription(patch.description);
  } catch (err) {
    throw mapUpdateGroupError(err);
  }
}
