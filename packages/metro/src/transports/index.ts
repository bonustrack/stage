/** Transport contract: connect to a station, emit raw events. No projection — adapters do that. */

export type RawEvent = {
  station: string;
  /** `'message' | 'reaction' | 'http'` — adapter `map()` dispatches off this. */
  kind: string;
  /** ISO timestamp. The dispatcher copies this onto the envelope. */
  ts: string;
  /** Station-native object: discord.js `Message.toJSON()`, raw Bot API update, `{headers, body}`. */
  payload: unknown;
};

export type EmitFn = (e: RawEvent) => void;

export interface Transport {
  readonly station: string;
  start(emit: EmitFn): Promise<void>;
  stop(): Promise<void>;
}
