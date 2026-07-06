export type ConversationLink =
  | { pathname: '/[convId]'; params: { convId: string } }
  | { pathname: '/channel/[convId]'; params: { convId: string } };

export function conversationLinkOf(convId: string, peerAddress?: string | null): ConversationLink {
  if (peerAddress) return { pathname: '/[convId]', params: { convId: peerAddress } };
  return { pathname: '/channel/[convId]', params: { convId } };
}
