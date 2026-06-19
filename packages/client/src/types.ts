/**
 * @file Shared HistoryEntry event/message envelope rendered identically by the web and mobile clients.
 */
/**
 * Shared event/message envelope used by the XMTP feed + chat-bubble renderer.
 *  Mirrors the daemon's `HistoryEntry`; both the Vue web client (apps/ui) and
 *  the React Native app (apps/app) render against this single shape so the two
 *  clients speak the same language. Keep dependency-free.
 */

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
