import { getPeerHandle } from './peerProfiles';
import {
  conversationLinkFor,
  conversationSharePathFor,
  dmLinkFor,
  isActiveConversationPathFor,
  messageShareUrlFor,
  profileLinkFor,
  type ConversationLink,
  type DmLink,
  type ProfileLink,
} from '@stage-labs/client/routing/deepLinks';

export function dmLinkOf(peerAddress: string, handle: string | null | undefined = getPeerHandle(peerAddress)): DmLink {
  return dmLinkFor(peerAddress, handle);
}

export function conversationLinkOf(
  convId: string,
  peerAddress?: string | null,
  handle: string | null | undefined = getPeerHandle(peerAddress),
): ConversationLink {
  return conversationLinkFor(convId, peerAddress, handle);
}

export function profileLinkOf(address: string, handle: string | null | undefined = getPeerHandle(address)): ProfileLink {
  return profileLinkFor(address, handle);
}

export function conversationSharePath(
  convId: string,
  peerAddress?: string | null,
  handle: string | null | undefined = getPeerHandle(peerAddress),
): string {
  return conversationSharePathFor(convId, peerAddress, handle);
}

export function messageShareUrlOf(convId: string, peerAddress: string | null, messageId: string): string {
  return messageShareUrlFor(conversationSharePath(convId, peerAddress), messageId);
}

export function isActiveConversationPath(
  pathname: string,
  convId: string,
  peerAddress?: string | null,
  handle: string | null | undefined = getPeerHandle(peerAddress),
): boolean {
  return isActiveConversationPathFor(pathname, convId, peerAddress, handle);
}
