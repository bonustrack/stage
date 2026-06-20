
import { PublicIdentity } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { lineOfConv, type XmtpConsent } from './xmtp.types';

function validMemberAddresses(addresses: string[]): string[] {
  return addresses
    .map(a => a.trim())
    .filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
}

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

function isNoInboxError(msg: string): boolean {
  return /inbox|identity|not.*regist|cannot.*find/i.test(msg);
}

export async function createGroup(
  addresses: string[],
  name?: string,
  imageUrl?: string,
): Promise<{ line: string; id: string }> {
  const members = validMemberAddresses(addresses);
  if (members.length === 0) throw new Error('Add at least one valid member address.');

  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const identities = members.map(a => new PublicIdentity(a, 'ETHEREUM'));
  const opts = buildCreateGroupOptions(name, imageUrl);

  try {
    const group = await (client.conversations as unknown as {
      newGroupWithIdentities: (
        peers: PublicIdentity[],
        opts?: { name?: string; imageUrl?: string },
      ) => Promise<{ id: string }>;
    }).newGroupWithIdentities(identities, opts);
    return { line: lineOfConv(group.id), id: group.id };
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    if (isNoInboxError(msg)) {
      throw new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
    }
    throw new Error(`Couldn't create the group: ${msg}`);
  }
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  const members = validMemberAddresses(addresses);
  if (members.length === 0) throw new Error('Add at least one valid member address.');

  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');

  const identities = members.map(a => new PublicIdentity(a, 'ETHEREUM'));
  try {
    await (conv as unknown as {
      addMembersByIdentity: (identities: PublicIdentity[]) => Promise<unknown>;
    }).addMembersByIdentity(identities);
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    if (isNoInboxError(msg)) {
      throw new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
    }
    if (/permission|admin|not.*allow|denied|unauthor/i.test(msg)) {
      throw new Error('Only a group admin can add members.');
    }
    throw new Error(`Couldn't add members: ${msg}`);
  }
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
