
import { PublicIdentity } from '@xmtp/react-native-sdk';
import {
  createGroupWith, addGroupMembersWith, requireValidMembers, type CreateGroupResult,
} from '@stage-labs/client/xmtp/groups';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { lineOfConv, type XmtpConsent } from './xmtp.types';

function buildCreateGroupOptions(
  name?: string, imageUrl?: string,
): { name?: string; imageUrl?: string } {
  const opts: { name?: string; imageUrl?: string } = {};
  const trimmedName = name?.trim();
  if (trimmedName) opts.name = trimmedName;
  const trimmedImage = imageUrl?.trim();
  if (trimmedImage) opts.imageUrl = trimmedImage;
  return opts;
}

export async function createGroup(
  addresses: string[],
  name?: string,
  imageUrl?: string,
): Promise<CreateGroupResult> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const opts = buildCreateGroupOptions(name, imageUrl);
  return createGroupWith(addresses, lineOfConv, async (members) => {
    const identities = members.map(a => new PublicIdentity(a, 'ETHEREUM'));
    return await (client.conversations as unknown as {
      newGroupWithIdentities: (
        peers: PublicIdentity[],
        opts?: { name?: string; imageUrl?: string },
      ) => Promise<{ id: string }>;
    }).newGroupWithIdentities(identities, opts);
  });
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  requireValidMembers(addresses);
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');

  await addGroupMembersWith(addresses, async (members) => {
    const identities = members.map(a => new PublicIdentity(a, 'ETHEREUM'));
    return await (conv as unknown as {
      addMembersByIdentity: (identities: PublicIdentity[]) => Promise<unknown>;
    }).addMembersByIdentity(identities);
  });
}

export async function leaveGroupConv(line: string): Promise<'left' | 'hidden'> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as {
    leaveGroup?: () => Promise<void>;
    updateConsent?: (state: XmtpConsent) => Promise<void>;
  };
  if (group.leaveGroup) {
    try {
      await group.leaveGroup();
      await group.updateConsent?.('denied').catch(() => undefined);
      return 'left';
    } catch {
    }
  }
  if (!group.updateConsent) throw new Error('Not a group conversation');
  await group.updateConsent('denied');
  return 'hidden';
}
