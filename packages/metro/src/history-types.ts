/** Shared history event types — leaf module imported by both history.ts and history-cursor.ts. */

import { Line } from './lines.js';

/** Typed, discriminated event payload alongside legacy `text`/`display`; additive + backward-compat. */
export type StructuredEvent =
  /** A normal chat message. */
  | { type: 'msg' }
  /** An emoji reaction to another message. `emoji` is the reaction glyph. */
  | { type: 'react'; emoji?: string; targetId?: string }
  /** An edit of a previously-sent message. */
  | { type: 'edit'; targetId?: string }
  /** A deletion of a previously-sent message. */
  | { type: 'delete'; targetId?: string }
  /** A reply that quotes/threads off another message. */
  | { type: 'reply'; replyTo?: string }
  /** A system/webhook/automation event (e.g. GitHub webhook). */
  | { type: 'system'; source?: string; eventName?: string }
  /** A push-notification delivery acknowledgement. */
  | { type: 'push-ack'; targetId?: string };

/** Canonical content-type on the wire. SINGLE source of truth for the typed `event` */
/** discriminator: define-train Envelope + protocol TrainEvent reference THIS, and the */
/** dispatcher carries it verbatim to `HistoryEntry.event` (absent ⇒ legacy classify). */
export type WireEvent = StructuredEvent;

export interface HistoryEntry {
  id: string;
  ts: string;
  station: string;
  line: Line;
  /** Optional channel/topic display name (e.g. "infra"). */
  lineName?: string;
  /** Universal participant URI of the sender. */
  from: Line;
  /** Display name (`@alice` / `bonustrack_`) — optional, human-readable. */
  fromName?: string;
  /** Universal recipient URI — almost always the conversation `line`. */
  to: Line;
  text?: string;
  /** Platform-side message id (Discord snowflake, Telegram int). Distinct from universal `id`. */
  messageId?: string;
  replyTo?: string;
  /** Station-native raw message — shape varies per station. Reactions/edits live here too. */
  payload?: unknown;
  /** Pre-rendered chat-bubble markdown — the user's first chat output should be this string verbatim. */
  display?: string;
  /** Typed, discriminated event shape — lets agents branch on kind instead of regexing `display`/`text`. */
  event?: StructuredEvent;
  /** Monotonic per-`line` seq (uint from 1), stamped by the dispatcher on append; */
  /** a gap ⇒ missed/dropped messages. Additive: absent on legacy/pre-field entries. */
  seq?: number;
}
