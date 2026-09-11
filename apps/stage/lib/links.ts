import {
  conversationLinkOf as pureConversationLinkOf,
  conversationSharePath as pureConversationSharePath,
  isActiveConversationPath,
  profileLinkOf as pureProfileLinkOf,
  type ConversationLink,
  type ProfileLink,
} from './conversationLink';
import { getPeerHandle } from './peerProfiles';

export function conversationLinkOf(convId: string, peerAddress?: string | null): ConversationLink {
  return pureConversationLinkOf(convId, peerAddress, getPeerHandle(peerAddress));
}

export function profileLinkOf(address: string): ProfileLink {
  return pureProfileLinkOf(address, getPeerHandle(address));
}

export function conversationSharePath(convId: string, peerAddress?: string | null): string {
  return pureConversationSharePath(convId, peerAddress, getPeerHandle(peerAddress));
}

export function isActiveConversationPathFor(pathname: string, convId: string, peerAddress?: string | null): boolean {
  return isActiveConversationPath(pathname, convId, peerAddress, getPeerHandle(peerAddress));
}
