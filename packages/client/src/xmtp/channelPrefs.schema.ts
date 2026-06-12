/** Zod boundary schema for the channel-prefs wire body
 *  (`stage.app/channel-prefs:1.0`).
 *
 *  The body is only ever authored by the user's OWN other installations (a
 *  single-member self-group), so it isn't an untrusted-peer surface like the tx
 *  codec. We still validate at the decode boundary so a drifted / corrupt
 *  payload throws (rendered unsupported) instead of an `as`-cast folding a
 *  malformed entry into the local stores. Entry count + string sizes are bounded
 *  so a pathological message can't blow up the fold. */

import { z } from 'zod';
import type { ZodType } from 'zod';
import type { ChannelPrefsMessage } from './channelPrefs';

const MAX_ENTRIES = 10_000; // one per conversation; generous upper bound
const MAX_ID = 256;         // convId is a hex conversation id
const MAX_NS = 32;          // ns timestamp as a decimal string

const entrySchema = z.object({
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  muted: z.boolean().optional(),
  lastReadNs: z.string().max(MAX_NS).optional(),
  ts: z.number(),
});

export const channelPrefsSchema: ZodType<ChannelPrefsMessage> = z.object({
  v: z.literal(1),
  snapshot: z.boolean().optional(),
  ts: z.number().optional(),
  entries: z.record(z.string().max(MAX_ID), entrySchema).refine(
    e => Object.keys(e).length <= MAX_ENTRIES,
    { message: `too many entries (>${MAX_ENTRIES})` },
  ),
}) as ZodType<ChannelPrefsMessage>;
