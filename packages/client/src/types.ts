
export interface HistoryEntry {
  id: string;
  ts: string;
  station: string;
  line: string;
  lineName?: string;
  from: string;
  fromName?: string;
  to: string;
  text?: string;
  messageId?: string;
  replyTo?: string;
  display?: string;
  payload?: unknown;
  pending?: boolean;
}
