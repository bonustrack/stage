
import { ConsentState, IdentifierKind, type Identifier } from '@xmtp/browser-sdk';
import {
  createGroupWith, addGroupMembersWith, requireValidMembers, type CreateGroupResult,
} from '@stage-labs/client/xmtp/groups';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client.web';
import { lineOfConv } from './xmtp.types';

function identifiersOf(addresses: string[]): Identifier[] {
  return addresses.map(a => ({
    identifier: a.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  }));
}

function buildCreateGroupOptions(
  name?: string, imageUrl?: string,
): { groupName?: string; groupImageUrlSquare?: string } {
  const opts: { groupName?: string; groupImageUrlSquare?: string } = {};
  const trimmedName = name?.trim();
  if (trimmedName) opts.groupName = trimmedName;
  const trimmedImage = imageUrl?.trim();
  if (trimmedImage) opts.groupImageUrlSquare = trimmedImage;
  return opts;
}

export async function createGroup(
  addresses: string[],
  name?: string,
  imageUrl?: string,
): Promise<CreateGroupResult> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const opts = buildCreateGroupOptions(name, imageUrl);
  return createGroupWith(addresses, lineOfConv, async (members) =>
    await client.conversations.createGroupWithIdentifiers(identifiersOf(members), opts));
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  requireValidMembers(addresses);
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as {
    addMembersByIdentifiers?: (identifiers: Identifier[]) => Promise<unknown>;
  };
  if (!group.addMembersByIdentifiers) throw new Error('Not a group conversation');
  const addMembers = group.addMembersByIdentifiers.bind(group);

  await addGroupMembersWith(addresses, async (members) =>
    await addMembers(identifiersOf(members)));
}

export function groupNameImage(
  conv: unknown,
): Promise<{ name: string; imageUrl: string; description: string }> {
  const g = conv as { name?: unknown; imageUrl?: unknown; description?: unknown };
  return Promise.resolve({
    name: typeof g.name === 'string' ? g.name : '',
    imageUrl: typeof g.imageUrl === 'string' ? g.imageUrl : '',
    description: typeof g.description === 'string' ? g.description : '',
  });
}

export async function leaveGroupConv(line: string): Promise<'left' | 'hidden'> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const selfInboxId = client.inboxId;
  const group = conv as unknown as {
    removeMembers?: (inboxIds: string[]) => Promise<void>;
  };
  if (selfInboxId && typeof group.removeMembers === 'function') {
    try {
      await group.removeMembers([selfInboxId]);
      await conv.updateConsentState(ConsentState.Denied).catch(() => undefined);
      return 'left';
    } catch { }
  }
  await conv.updateConsentState(ConsentState.Denied);
  return 'hidden';
}
