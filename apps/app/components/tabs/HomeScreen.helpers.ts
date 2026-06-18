/** HomeScreen helpers — the Row shape + the pure summarise/format/topic utils
 *  extracted from HomeScreen.tsx (phase-2 lint, behaviour identical). */

import type { Conversation } from '@xmtp/react-native-sdk';
import { summarizeConversation } from '../../modules/messaging';
import type { ConversationView } from '../../modules/messaging';

/** Channels-list row. The view-model fields all live on the `ConversationView`
 *  domain type owned by `modules/messaging`; `Row` is that view plus an index
 *  signature so it stays a structural superset of `CachedRow` and can be passed
 *  straight through `setCachedRows` without casting. */
export type Row = ConversationView & Record<string, unknown>;

/** Extract the conversation id from an XMTP MLS topic. Stream `DecodedMessage`s
 *  only expose `topic` (`/xmtp/mls/1/g-<hexId>/proto`), not `conversationId`, so
 *  the `g-<id>` segment is the bridge back to `Row.convId` (which stores
 *  `conv.id`). Returns null when the topic doesn't match the expected shape. */
export function convIdFromTopic(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m ? m[1]! : null;
}

/** Fixed ChannelRow height: 14px vertical padding ×2 + ~48px content (title 22 +
 *  4 margin + 22 badge-reserve) + 1px separator. Used by getItemLayout (#5).
 *  Group label chips render INLINE on the name row (not a separate line), so
 *  every row is uniform height regardless of labels. */
export const CHANNEL_ROW_HEIGHT = 77;

/** Formats a message timestamp for display in the channel list. */
export function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Summarise a conversation into a channels-list `Row`. Thin wrapper over the
 *  facade's `summarizeConversation` adapter (which owns the SDK access + all the
 *  summarise logic, unchanged); the returned `ConversationView` IS a `Row`
 *  (Row = ConversationView + index signature), so this just forwards it. */
export async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  /** Spread into a fresh object so it satisfies `Row`'s open index signature
   *  (the CachedRow superset); `ConversationView` itself has no index sig. */
  return { ...await summarizeConversation(conv, selfInboxId) };
}
