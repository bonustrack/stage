
import type { Conversation } from '@xmtp/react-native-sdk';
import { summarizeConversation } from '../../modules/messaging';
import type { ConversationView } from '../../modules/messaging';

export type Row = ConversationView & Record<string, unknown>;

export function convIdFromTopic(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m?.[1] ?? null;
}

export const CHANNEL_ROW_HEIGHT = 77;

export function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  return { ...await summarizeConversation(conv, selfInboxId) };
}
