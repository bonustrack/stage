/** Shared event envelope shape used by the XMTP feed + bubble renderer. Mirrors
 *  apps/app/lib/types.ts so the two clients can talk the same language even though
 *  the web build never sees the daemon's event log. */

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
