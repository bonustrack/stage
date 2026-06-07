/** Zod boundary schema for the Metro poll wire body (`metro.box/poll:1.0`).
 *
 *  A poll arrives over XMTP as a JSON-encoded EncodedContent body. Pairing this
 *  schema with `decodeJsonContent(bytes, pollSchema)` makes a drifted poll body
 *  throw loudly (with a logged reason) at the codec boundary, instead of an
 *  `as PollContent` cast handing the renderer a malformed object. */

import { z } from 'zod';
import type { ZodType } from 'zod';
import type { PollContent } from './poll';

const optionSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
});

/** Validates the on-wire poll shape: a stable id, a question, and >= 2 options. */
export const pollContentSchema: ZodType<PollContent> = z.object({
  pollId: z.string().min(1),
  question: z.string().min(1),
  header: z.string().optional(),
  options: z.array(optionSchema).min(2),
  multiSelect: z.boolean().optional(),
}) as unknown as ZodType<PollContent>;
