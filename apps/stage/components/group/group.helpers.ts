import {
  addGroupMembers, convIdOfLine, convOfLine, memberInboxToAddressMap, removeGroupMembers,
} from '../../modules/messaging';

function convIdOf(line: string): string {
  const convId = convIdOfLine(line);
  if (!convId) throw new Error('Conversation not found');
  return convId;
}

async function sortedMembers(line: string): Promise<string[]> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const map = await memberInboxToAddressMap(conv);
  return Object.values(map).sort((a, b) => a.localeCompare(b));
}

export async function addGroupMember(line: string, addr: string): Promise<string[]> {
  await addGroupMembers(convIdOf(line), [addr]);
  return sortedMembers(line);
}

export async function removeGroupMember(line: string, addr: string): Promise<string[]> {
  await removeGroupMembers(convIdOf(line), [addr]);
  return sortedMembers(line);
}
