/**
 * @file Conversation-metadata fetcher (the queryFn behind ['xmtp','convMeta',convId]) shared by the chat-view topnav hook and the group-info screen so name/image/description/members resolve through one Query key instead of duplicate fetches.
 */

// Import the helpers from their defining submodules rather than the `lib/xmtp`
// barrel: the barrel pulls in the whole xmtp graph (incl. xmtp.feed →
// feedQuery → queries → here), forming a static import cycle. The submodules
// are leaf-ish, so this keeps the dependency acyclic.
import { lineOfConv } from '../../lib/xmtp.types';
import { convOfLine } from '../../lib/xmtp.client';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
} from '../../lib/xmtp.identity';

export interface ConvMeta {
  peerAddr: string | null;
  isGroup: boolean;
  /** null = not resolved yet, '' = group with no name, else the name. */
  groupName: string | null;
  groupImage: string;
  /** Group's XMTP-metadata description ('' = none). Empty for DMs. */
  groupDescription: string;
  memberAddrs: string[];
  inboxToAddr: Record<string, string>;
}

/** Default placeholder metadata for an unresolved or missing conversation. */
export const EMPTY_CONV_META: ConvMeta = {
  peerAddr: null, isGroup: false, groupName: null, groupImage: '',
  groupDescription: '', memberAddrs: [], inboxToAddr: {},
};

interface GroupMetaAccessor {
  name?: () => Promise<string>;
  imageUrl?: () => Promise<string>;
  description?: () => Promise<string>;
}

/** Resolve a group conv's name/image/description/members into the ConvMeta group shape. */
async function fetchGroupConvMeta(
  conv: Parameters<typeof groupMemberEthAddresses>[0],
  inboxToAddr: Record<string, string>,
): Promise<ConvMeta> {
  const g = conv as unknown as GroupMetaAccessor;
  const [members, name, image, description] = await Promise.all([
    groupMemberEthAddresses(conv),
    g.name?.() ?? Promise.resolve(''),
    g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
    g.description?.().catch(() => '') ?? Promise.resolve(''),
  ]);
  return {
    peerAddr: null, isGroup: true, groupName: name ?? '', groupImage: image ?? '',
    groupDescription: description ?? '', memberAddrs: members, inboxToAddr,
  };
}

/** Resolve a conversation's shared metadata (peer/group name, image, members) by line id. */
export async function fetchConvMeta(convId: string): Promise<ConvMeta> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return EMPTY_CONV_META;
  const [peer, inboxToAddr] = await Promise.all([
    peerEthAddressOfDm(conv),
    memberInboxToAddressMap(conv),
  ]);
  if (peer) return { ...EMPTY_CONV_META, peerAddr: peer, inboxToAddr };
  return fetchGroupConvMeta(conv, inboxToAddr);
}

/** The group-info screen's EXTRA, non-shared data: per-member admin roles, keyed by lower-cased eth address. Derived from the SDK admin lists + the already- resolved inbox->addr map (passed in so we don't re-fetch members here). */
/** Resolve each group member's role (owner/admin/member) keyed by lower-cased eth address. */
export async function fetchGroupRoles(
  convId: string,
  inboxToAddr: Record<string, string>,
): Promise<Record<string, 'owner' | 'admin' | 'member'>> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return {};
  const group = conv as unknown as {
    listSuperAdmins?: () => Promise<string[]>;
    listAdmins?: () => Promise<string[]>;
  };
  const [supers, admins] = await Promise.all([
    group.listSuperAdmins?.().catch(() => [] as string[]) ?? Promise.resolve([] as string[]),
    group.listAdmins?.().catch(() => [] as string[]) ?? Promise.resolve([] as string[]),
  ]);
  const superSet = new Set(supers.map(s => s.toLowerCase()));
  const adminSet = new Set(admins.map(a => a.toLowerCase()));
  const roles: Record<string, 'owner' | 'admin' | 'member'> = {};
  for (const [inboxId, addr] of Object.entries(inboxToAddr)) {
    const iid = inboxId.toLowerCase();
    roles[addr] = superSet.has(iid) ? 'owner' : adminSet.has(iid) ? 'admin' : 'member';
  }
  return roles;
}
