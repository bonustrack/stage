
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
