/** Conversation-list domain types, behind the facade (stage 2).
 *
 *  Plain JS view-models for a conversation row - no XMTP SDK handle leaks into
 *  consumers. Built by the adapters in `./conversation`. */

/** Full channels-list row view-model - the domain projection of a conversation
 *  the Home channels list renders. Every field is a plain JS value (no SDK
 *  handle), so consumers never touch `@xmtp/react-native-sdk`. */
export interface ConversationView {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  /** Eth address whose stamp.fyi avatar renders in the row (latest sender,
   *  else DM peer / channel-id seed). Ignored when `avatarUri` is set. */
  avatarAddress: string | null;
  /** Group-uploaded image (ipfs:// or http URL). Takes precedence over the seed. */
  avatarUri: string | null;
  /** DM peer address (null for groups). */
  peerAddress: string | null;
  /** Eth address of the latest message's sender (null if self/unknown). */
  lastSenderAddress: string | null;
  /** Whether the local user sent the latest message → "You: …" prefix. */
  lastFromSelf: boolean;
  /** Cached inbox → eth address map for live stream avatar resolution. */
  inboxToAddr: Record<string, string>;
  /** Count of unread inbound messages (0 hides the badge). */
  unreadCount: number;
  /** Cached per-conv lastReadNs for incremental recounts. */
  lastReadNs: number;
  /** Synced "explicitly marked unread" flag (forces the badge on). */
  markedUnread: boolean;
  /** Own inbox id. */
  selfInboxId: string;
  /** Group labels (groups only, empty for DMs). */
  labels: string[];
  /** Linked GitHub issue/PR URL (groups only, optional). */
  github?: string;
}

/** Just the avatar fields of a message request - the lightest projection, used
 *  by the notifications-card preview pile (no title / preview-text resolution,
 *  so no conv.sync()/messages() round-trip). */
export type RequestAvatarDescriptor = Pick<
  ConversationRequestView,
  'convId' | 'avatarAddress' | 'avatarUri' | 'isGroup'
>;

/** Lighter message-request row view-model (the requests screen + the
 *  notifications-card preview pile). */
export interface ConversationRequestView {
  convId: string;
  title: string;
  /** DM peer address (null for groups). */
  peerAddress: string | null;
  /** Stamp seed: peer (DM) or channel-id (group). Ignored when avatarUri set. */
  avatarAddress: string | null;
  /** Group-uploaded image (groups only). */
  avatarUri: string | null;
  preview: string;
  isGroup: boolean;
}
