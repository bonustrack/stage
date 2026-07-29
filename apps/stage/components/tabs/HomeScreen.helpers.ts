
import type { Conversation } from '@xmtp/react-native-sdk';
import { filterChannelRows, sortChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import { summarizeConversation } from '../../modules/messaging';
import type { ConversationView } from '../../modules/messaging';

export type Row = ConversationView & Record<string, unknown>;

export async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  return { ...await summarizeConversation(conv, selfInboxId) };
}

export interface SortInputs {
  rows: Row[] | null;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
  pinned: Set<string>;
}

export function deriveSortedRows(i: SortInputs): Row[] {
  const filtered = filterChannelRows(i.rows ?? [], {
    enabledLabels: i.enabledLabels,
    unreadOnly: i.unreadOnly,
  });
  return sortChannelRows(filtered, i.pinned);
}
