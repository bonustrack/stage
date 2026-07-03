
import type { Conversation } from '@xmtp/react-native-sdk';
import { summarizeConversation } from '../../modules/messaging';
import type { ConversationView } from '../../modules/messaging';

export type Row = ConversationView & Record<string, unknown>;

export const CHANNEL_ROW_HEIGHT = 77;

export async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  return { ...await summarizeConversation(conv, selfInboxId) };
}
