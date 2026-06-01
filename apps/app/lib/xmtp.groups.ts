/** XMTP group lifecycle helpers (create / add members / leave) for the app's
 *  XMTP client lib. Extracted from lib/xmtp.ts (phase-2 lint split); re-exported
 *  from there. */

import { PublicIdentity } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { lineOfConv, type XmtpConsent } from './xmtp.types';

/** Create a new XMTP group conversation with the given members.
 *
 *  `addresses` accepts 0x Ethereum addresses (.eth resolution is done by the
 *  caller / create-group screen via resolveEnsName before we get here — this
 *  helper only deals in raw addresses). At least one member is required.
 *
 *  Mirrors the daemon's `newGroup` action but uses the RN SDK 5.7 shape: the
 *  installed @xmtp/react-native-sdk has no `createGroupWithIdentifiers` —
 *  instead `conversations.newGroupWithIdentities(PublicIdentity[], opts)` where
 *  `opts.name` sets the group title. We build PublicIdentity the same way
 *  `openDmWithAddress` does (`new PublicIdentity(addr, 'ETHEREUM')`).
 *
 *  Gotcha: every member must already have an XMTP inbox. The SDK throws when an
 *  address has never registered on XMTP; we surface that as a clear message so
 *  the screen can tell the user which address isn't reachable. */
export async function createGroup(addresses: string[], name?: string): Promise<{ line: string; id: string }> {
  const members = addresses
    .map(a => a.trim())
    .filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
  if (members.length === 0) throw new Error('Add at least one valid member address.');

  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const identities = members.map(a => new PublicIdentity(a, 'ETHEREUM'));
  const opts: { name?: string } = {};
  const trimmedName = name?.trim();
  if (trimmedName) opts.name = trimmedName;

  try {
    const group = await (client.conversations as unknown as {
      newGroupWithIdentities: (
        peers: PublicIdentity[],
        opts?: { name?: string },
      ) => Promise<{ id: string }>;
    }).newGroupWithIdentities(identities, opts);
    return { line: lineOfConv(group.id), id: group.id };
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    /** The native side rejects addresses with no XMTP inbox — make that legible. */
    if (/inbox|identity|not.*regist|cannot.*find/i.test(msg)) {
      throw new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
    }
    throw new Error(`Couldn't create the group: ${msg}`);
  }
}

/** Add members to an existing group by Ethereum address. Resolves the
 *  conversation for `convId`, builds `PublicIdentity[]` the same way
 *  `createGroup` does, and calls the SDK's `group.addMembersByIdentity` (5.7.0).
 *  Throws a legible error for addresses not on XMTP and for permission denials
 *  (only group admins may add members). */
export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  const members = addresses
    .map(a => a.trim())
    .filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
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
    if (/inbox|identity|not.*regist|cannot.*find/i.test(msg)) {
      throw new Error("One or more addresses aren't on XMTP yet, so they can't be added.");
    }
    if (/permission|admin|not.*allow|denied|unauthor/i.test(msg)) {
      throw new Error('Only a group admin can add members.');
    }
    throw new Error(`Couldn't add members: ${msg}`);
  }
}

/** Leave a group conversation. The XMTP RN SDK (5.7) exposes `group.leaveGroup()`
 *  natively — it removes the local inbox from the group's member list (a real
 *  leave, not a local hide). Falls back to denying consent (local hide) when the
 *  conversation predates the method or `leaveGroup` throws, so the row still
 *  disappears from the user's list either way. Returns `'left'` for a true leave,
 *  `'hidden'` when it could only deny consent. */
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
      /** Also deny consent so the conversation drops out of the local list
       *  immediately, before the member-removal commit syncs back. */
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
