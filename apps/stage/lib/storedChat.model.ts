export interface StoredChatRef {
  peerAddress: string | null;
  groupName: string;
}

export function chatLabelOf(chat: StoredChatRef | null | undefined, peerLabel: (address: string) => string): string {
  if (chat === null || chat === undefined) return '';
  if (chat.peerAddress !== null) return peerLabel(chat.peerAddress);
  const name = chat.groupName.trim();
  return name === '' ? 'Unnamed channel' : name;
}
