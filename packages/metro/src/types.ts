/** Core types shared between the Client SDK, the CLI, and each station package. */

import type { HistoryKind } from './history.js';

/** Conversation URI: `metro://<station>/<path>`. Branded for routing safety. */
export type Line = string & { readonly __line: unique symbol };
export const asLine = (s: string): Line => s as Line;

/** Outbound action handler. Each station declares its own action set. */
export type ActionFn<TArgs = unknown, TResult = unknown> = (args: TArgs) => Promise<TResult>;

/** Station shape. One file per integration. `actions` is open — names are station-defined. */
export interface Station {
  readonly name: string;
  /** Returns true iff env/state are present for this station to run. */
  configured(): boolean;
  /** Connect upstream; invoke `emit` for every inbound envelope. */
  start(emit: (e: Envelope) => void): Promise<void>;
  /** Disconnect / drop resources. Idempotent. */
  stop(): Promise<void>;
  /** Outbound primitives keyed by station-defined verb. */
  readonly actions: Record<string, ActionFn>;
}

/** Universal event envelope — open `kind`, open `payload`. The mobile-app + bubble formatter read `text`. */
export interface Envelope {
  /** Universal metro id — minted by the station (or by the client at emit time). */
  id: string;
  /** ISO timestamp — platform time when available, else now. */
  ts: string;
  /** `'message' | 'reaction' | 'edit' | 'webhook' | …` — station defines the catalogue. */
  kind: string;
  station: string;
  /** Conversation URI (`metro://<station>/<path>`). */
  line: Line;
  lineName?: string;
  /** Sender participant URI. */
  from: Line;
  fromName?: string;
  /** Recipient participant URI — usually the same as `line`; for DMs may be the local user URI. */
  to?: Line;
  /** Primary text projection — chat-bubble formatter + mobile app render this. */
  text?: string;
  /** Platform-side message id (Discord snowflake, Telegram int, …). */
  messageId?: string;
  /** Set on `kind: 'reaction'`. */
  emoji?: string;
  /** Reply target — universal id or platform id. */
  replyTo?: string;
  /** True iff conversation has a single human counterpart (DM). */
  isPrivate?: boolean;
  /** Raw platform-native object — consumers narrow on `station`. */
  payload?: unknown;
  /** Pre-rendered chat-bubble markdown — Monitor reads this through the truncation cap. */
  display?: string;
}

/** Bridge between the legacy `HistoryEntry` (HistoryKind enum) and the open-kind `Envelope`. */
export type EnvelopeKind = HistoryKind | string;
