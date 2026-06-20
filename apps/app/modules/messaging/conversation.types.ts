
export interface ConversationView {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  avatarAddress: string | null;
  avatarUri: string | null;
  peerAddress: string | null;
  lastSenderAddress: string | null;
  lastFromSelf: boolean;
  inboxToAddr: Record<string, string>;
  unreadCount: number;
  lastReadNs: number;
  markedUnread: boolean;
  selfInboxId: string;
  labels: string[];
  github?: string;
}

export type RequestAvatarDescriptor = Pick<
  ConversationRequestView,
  'convId' | 'avatarAddress' | 'avatarUri' | 'isGroup'
>;

export interface ConversationRequestView {
  convId: string;
  title: string;
  peerAddress: string | null;
  avatarAddress: string | null;
  avatarUri: string | null;
  preview: string;
  isGroup: boolean;
}
