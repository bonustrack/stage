/** Event/state shapes — mirror the daemon's HistoryEntry. Synced by hand with apps/app/lib/types.ts. */

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
}
