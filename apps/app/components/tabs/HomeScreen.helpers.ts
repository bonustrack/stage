/** @file HomeScreen.helpers — the channels-list Row type plus the pure summarise/format/topic utilities (e.g. convIdFromTopic) extracted from HomeScreen.tsx. */

import type { Conversation } from '@xmtp/react-native-sdk';
import { summarizeConversation } from '../../modules/messaging';
import type { ConversationView } from '../../modules/messaging';

/** Channels-list row: the `ConversationView` domain type plus an index signature so it stays a structural superset of `CachedRow` and passes through `setCachedRows` without casting. */
export type Row = ConversationView & Record<string, unknown>;

/** Extract the conversation id from an XMTP MLS topic's `g-<id>` segment (the bridge back to `Row.convId`), returning null when the topic doesn't match the expected shape. */
export function convIdFromTopic(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m?.[1] ?? null;
}

/** Fixed ChannelRow height (77px) used by getItemLayout; label chips render inline on the name row so every row stays uniform height regardless of labels. */
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

/** Summarise a conversation into a channels-list `Row` via the facade's `summarizeConversation` adapter (which owns SDK access + summarise logic); the returned `ConversationView` IS a `Row`, so this just forwards it. */
export async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  /** Spread into a fresh object so it satisfies `Row`'s open index signature (the CachedRow superset); `ConversationView` itself has no index sig. */
  return { ...await summarizeConversation(conv, selfInboxId) };
}
