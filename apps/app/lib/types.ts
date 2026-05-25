/** Chat-bubble shape — mirrors the daemon's `HistoryEntry` for the XMTP feed
 *  adapter in `./xmtp.ts` and the `MessengerBubble` component. Kept in sync by hand. */

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
}
