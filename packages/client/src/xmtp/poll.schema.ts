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

const questionSchema = z.object({
  question: z.string().min(1),
  header: z.string().optional(),
  // A CHOICE question needs >=2 options; an OPEN (free-text) question may carry
  // 0 options (pure free-text) or any number alongside the text input.
  options: z.array(optionSchema).optional(),
  multiSelect: z.boolean().optional(),
  open: z.boolean().optional(),
}).refine(
  q => q.open === true || (q.options?.length ?? 0) >= 2,
  { message: 'a choice question needs >=2 options (or set open:true for free-text)' },
);

/** Validates the on-wire poll shape. Accepts BOTH forms: the multi-question
 *  `questions[]` array (AskUserQuestion shape) and the legacy single-question
 *  top-level fields. A poll must satisfy at least one of the two via the
 *  refinement so `normalizeQuestions()` always yields a non-empty array. */
export const pollContentSchema: ZodType<PollContent> = z.object({
  pollId: z.string().min(1),
  questions: z.array(questionSchema).min(1).optional(),
  question: z.string().min(1).optional(),
  header: z.string().optional(),
  options: z.array(optionSchema).min(2).optional(),
  multiSelect: z.boolean().optional(),
}).refine(
  p => (p.questions && p.questions.length > 0) || (typeof p.question === 'string' && (p.options?.length ?? 0) >= 2),
  { message: 'poll needs either questions[] or a question + options' },
) as unknown as ZodType<PollContent>;
