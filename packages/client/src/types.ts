import type { EntryPayload } from './xmtp/entryPayload';

export interface HistoryEntry {
  id: string;
  ts: string;
  station: string;
  line: string;
  from: string;
  to: string;
  text?: string;
  messageId?: string;
  replyTo?: string;
  payload?: EntryPayload;
  pending?: boolean;
}
