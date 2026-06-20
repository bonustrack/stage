/** @file Shared HistoryEntry event/message envelope (mirroring the daemon's shape) rendered identically by the Vue web client and the React Native app; kept dependency-free. */

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
  /** Pre-rendered chat-bubble markdown. */
  display?: string;
  /** Raw platform-native payload (Discord message, GitHub webhook body, etc). Shape varies per station. */
  payload?: unknown;
  /** Optimistic (locally-sent, not yet confirmed by the network). Rendered at reduced opacity until the send resolves, then flipped to normal. Web-only today; harmless on mobile. */
  pending?: boolean;
}
