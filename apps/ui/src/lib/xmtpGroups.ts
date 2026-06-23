
import { IdentifierKind, ConsentState, type Identifier } from '@xmtp/browser-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtpClient';
import { lineOfConv } from '@stage-labs/client/xmtp/line';

export const ASK_QUESTION_MEMBERS = [
  '0x0bA043c6F25085C68042bad079c29bD8f16a651A',
  '0x25391bddaa8d7ecdfe183615c1005259cd3b79d5',
] as const;

export const METRO_API_URL = 'https://api.metro.box';

export async function createAskQuestionGroup(): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const selfAddr = client.accountIdentifier?.identifier.toLowerCase() ?? '';
  if (!selfAddr) throw new Error('No local XMTP address available.');
  const res = await fetch(`${METRO_API_URL}/ask-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: selfAddr }),
  });
  const json = await res.json().catch(() => ({})) as { conversationId?: string; error?: string };
  if (!res.ok || !json.conversationId) {
    throw new Error(json.error ?? `Could not start the conversation (${res.status}).`);
  }
  await client.conversations.sync().catch(() => undefined);
  return json.conversationId;
}

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.createDmWithIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  return dm.id;
}

function validMemberAddresses(addresses: string[]): string[] {
  return addresses
    .map(a => a.trim())
    .filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
}

function identitiesOf(addresses: string[]): Identifier[] {
  return addresses.map(a => ({
    identifier: a.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  }));
}

function isNoInboxError(msg: string): boolean {
  return /inbox|identity|not.*regist|cannot.*find/i.test(msg);
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
): Promise<{ line: string; id: string }> {
  const members = validMemberAddresses(addresses);
  if (members.length === 0) throw new Error('Add at least one valid member address.');

  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try {
    const group = await client.conversations.createGroupWithIdentifiers(
      identitiesOf(members),
      buildCreateGroupOptions(name, imageUrl),
    );
    return { line: lineOfConv(group.id), id: group.id };
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    if (isNoInboxError(msg)) {
      throw new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
    }
    throw new Error(`Couldn't create the group: ${msg}`);
  }
}

export async function leaveGroup(convId: string): Promise<'left' | 'hidden'> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const selfInboxId = client.inboxId;
  const group = conv as unknown as {
    removeMembers?: (inboxIds: string[]) => Promise<void>;
    updateConsentState?: (state: ConsentState) => Promise<void>;
  };
  if (selfInboxId && group.removeMembers) {
    try {
      await group.removeMembers([selfInboxId]);
      await group.updateConsentState?.(ConsentState.Denied).catch(() => undefined);
      return 'left';
    } catch {
    }
  }
  if (!group.updateConsentState) throw new Error('Not a group conversation');
  await group.updateConsentState(ConsentState.Denied);
  return 'hidden';
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  const members = validMemberAddresses(addresses);
  if (members.length === 0) throw new Error('Add at least one valid member address.');

  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as {
    addMembersByIdentifiers?: (identifiers: Identifier[]) => Promise<unknown>;
  };
  if (!group.addMembersByIdentifiers) throw new Error('Not a group conversation');

  try {
    await group.addMembersByIdentifiers(identitiesOf(members));
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
