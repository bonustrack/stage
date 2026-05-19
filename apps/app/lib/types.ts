/** Event/state shapes — mirror the daemon's `HistoryEntry`. Kept in sync by hand. */

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
  /** Pre-rendered chat-bubble markdown. */
  display?: string;
  /** Raw platform-native payload (Discord message, GitHub webhook body, etc). Shape varies per station. */
  payload?: unknown;
}

/** Shape returned by `GET /api/state`. */
export interface StateSnapshot {
  claims: Record<string, string>;
  lines: string[];
  recent_history: HistoryEntry[];
  bot_ids: Record<string, string>;
}
