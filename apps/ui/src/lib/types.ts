/** Event/state shapes — mirror the daemon's HistoryEntry. Synced by hand with apps/app/lib/types.ts. */

export type HistoryKind = 'inbound' | 'outbound' | 'edit' | 'react';

export interface HistoryEntry {
  id: string;
  ts: string;
  kind: HistoryKind;
  station: string;
  line: string;
  lineName?: string;
  from: string;
  fromName?: string;
  to: string;
  text?: string;
  emoji?: string;
  messageId?: string;
  replyTo?: string;
  display?: string;
}
