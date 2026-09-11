import { conversationPathFor, profileSlugFor, stageLabelOf } from '@stage-labs/client/routing/handles';

export type ConversationLink =
  | { pathname: '/[convId]'; params: { convId: string } }
  | { pathname: '/channel/[convId]'; params: { convId: string } };

export interface ProfileLink { pathname: '/profile/[address]'; params: { address: string } }

export function conversationLinkOf(convId: string, peerAddress?: string | null, handle?: string | null): ConversationLink {
  if (peerAddress) return { pathname: '/[convId]', params: { convId: profileSlugFor(peerAddress, handle) } };
  return { pathname: '/channel/[convId]', params: { convId } };
}

export function profileLinkOf(address: string, handle?: string | null): ProfileLink {
  return { pathname: '/profile/[address]', params: { address: profileSlugFor(address, handle) } };
}

export function conversationSharePath(convId: string, peerAddress?: string | null, handle?: string | null): string {
  if (peerAddress) return conversationPathFor(peerAddress, handle);
  return `/channel/${convId}`;
}

export function isActiveConversationPath(
  pathname: string,
  convId: string,
  peerAddress?: string | null,
  handle?: string | null,
): boolean {
  if (!pathname) return false;
  const path = pathname.toLowerCase();
  if (path === `/channel/${convId}`.toLowerCase()) return true;
  if (!peerAddress) return false;
  if (path === `/${peerAddress}`.toLowerCase()) return true;
  const label = stageLabelOf(handle);
  return label !== null && path === `/${label}`;
}
