export type ConversationLink =
  | { pathname: '/[convId]'; params: { convId: string } }
  | { pathname: '/channel/[convId]'; params: { convId: string } };

export function conversationLinkOf(convId: string, peerAddress?: string | null): ConversationLink {
  if (peerAddress) return { pathname: '/[convId]', params: { convId: peerAddress } };
  return { pathname: '/channel/[convId]', params: { convId } };
}

export function isActiveConversationPath(
  pathname: string,
  convId: string,
  peerAddress?: string | null,
): boolean {
  if (!pathname) return false;
  const path = pathname.toLowerCase();
  if (path === `/channel/${convId}`.toLowerCase()) return true;
  return peerAddress ? path === `/${peerAddress}`.toLowerCase() : false;
}
