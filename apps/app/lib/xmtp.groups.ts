/** @file XMTP group lifecycle helpers (create / add members / leave) for the app's XMTP client lib; extracted from lib/xmtp.ts and re-exported from there. */

import { PublicIdentity } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { lineOfConv, type XmtpConsent } from './xmtp.types';

/** Trim and keep only well-formed 0x Ethereum addresses from the input list. */
function validMemberAddresses(addresses: string[]): string[] {
  return addresses
    .map(a => a.trim())
    .filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
}

/** Build the RN SDK CreateGroupOptions, including name/imageUrl only when non-empty. */
function buildCreateGroupOptions(
  name?: string, imageUrl?: string,
): { name?: string; imageUrl?: string } {
  const opts: { name?: string; imageUrl?: string } = {};
  const trimmedName = name?.trim();
  if (trimmedName) opts.name = trimmedName;
  /** The RN SDK 5.7 CreateGroupOptions carries `imageUrl` (the group's imageUrlSquare); set it at creation so no follow-up update call is needed. Caller passes an already-uploaded https blob url. */
  const trimmedImage = imageUrl?.trim();
  if (trimmedImage) opts.imageUrl = trimmedImage;
  return opts;
}

/** True when an XMTP error message indicates an address has no inbox yet. */
function isNoInboxError(msg: string): boolean {
  return /inbox|identity|not.*regist|cannot.*find/i.test(msg);
}

/** Creates a new XMTP group from raw 0x addresses via the RN SDK 5.7 `newGroupWithIdentities`; every member must already have an XMTP inbox, else a clear unreachable-address error is surfaced. */
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
    /** The native side rejects addresses with no XMTP inbox — make that legible. */
    if (isNoInboxError(msg)) {
      throw new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
    }
    throw new Error(`Couldn't create the group: ${msg}`);
  }
}

/** Adds members to an existing group by address via `addMembersByIdentity` (5.7.0), throwing legible errors for addresses not on XMTP and for non-admin permission denials. */
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

/** Leaves a group via the RN SDK 5.7 `leaveGroup()` (a real member-list removal), falling back to denying consent (local hide) when unavailable; returns `'left'` for a true leave or `'hidden'` otherwise. */
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
      /** Also deny consent so the conversation drops out of the local list immediately, before the member-removal commit syncs back. */
      await group.updateConsent?.('denied').catch(() => undefined);
      return 'left';
    } catch {
      /* fall through to consent-deny hide */
    }
  }
  if (!group.updateConsent) throw new Error('Not a group conversation');
  await group.updateConsent('denied');
  return 'hidden';
}
