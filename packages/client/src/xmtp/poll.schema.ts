/** @file Zod boundary schema for the Metro poll wire body (`metro.box/poll:1.0`); paired with `decodeJsonContent` it throws loudly at the codec boundary on a drifted body instead of an `as PollContent` cast handing the renderer a malformed object. */

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
  /** A choice question needs >=2 options; an open (free-text) question may carry 0 options or any number alongside the text input. */
  options: z.array(optionSchema).optional(),
  multiSelect: z.boolean().optional(),
  open: z.boolean().optional(),
}).refine(
  q => q.open === true || (q.options?.length ?? 0) >= 2,
  { message: 'a choice question needs >=2 options (or set open:true for free-text)' },
);

/** Validates the on-wire poll shape, accepting both the multi-question `questions[]` array (AskUserQuestion) and the legacy single-question top-level fields; the refinement requires at least one so `normalizeQuestions()` always yields a non-empty array. */
export const pollContentSchema: ZodType<PollContent> = z.object({
  pollId: z.string().min(1),
  questions: z.array(questionSchema).min(1).optional(),
  question: z.string().min(1).optional(),
  header: z.string().optional(),
  options: z.array(optionSchema).min(2).optional(),
  multiSelect: z.boolean().optional(),
}).refine(
  p => (p.questions !== undefined && p.questions.length > 0) || (typeof p.question === 'string' && (p.options?.length ?? 0) >= 2),
  { message: 'poll needs either questions[] or a question + options' },
) as unknown as ZodType<PollContent>;
