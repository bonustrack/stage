// Standardized messaging verb-contract shared by the CLI and the integration trains.
// One canonical envelope + a fixed verb set so messages can be sent/replied/reacted/
// queried uniformly across stations without per-integration custom payloads.

import { Line } from './lines.js';

/** A normalized attachment: either a local/remote `url` or inline base64 `data`. */
export interface Attachment {
  kind: 'image' | 'file' | 'voice' | 'sticker';
  url?: string;
  data?: string;
  mime?: string;
  name?: string;
}

/** The canonical envelope. All optional but `line`; verb decides which fields apply. */
export interface MessagingEnvelope {
  line: string;
  text?: string;
  replyTo?: string;
  attachments?: Attachment[];
  emoji?: string;
  messageId?: string;
  limit?: number;
  before?: string;
  since?: string;
  account?: string;
}

/** The canonical platform stations — single source of truth, imported by the
 *  account CLI, the sessions binding layer, and the messaging contract below. */
export const STATIONS = ['xmtp', 'discord', 'telegram'] as const;
export type Station = (typeof STATIONS)[number];

/** Stations that speak the messaging contract (routable by `metro send/reply/…`).
 *  Same set as STATIONS; kept as named aliases for the contract's call sites. */
export const MESSAGING_STATIONS = STATIONS;
export type MessagingStation = Station;
export const isMessagingStation = (s: string | null): s is MessagingStation =>
  s !== null && (MESSAGING_STATIONS as readonly string[]).includes(s);

/** Parse the station (train name) out of a line. The line already encodes it. */
export const stationOf = (line: string): string | null => Line.station(line);

/** A clear, uniform error string for verbs a station cannot perform. */
export const unsupported = (verb: string, station: string): string =>
  `unsupported verb '${verb}' on ${station}`;
