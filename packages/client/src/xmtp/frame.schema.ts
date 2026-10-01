import { z } from 'zod';

export const FRAME_MAX_CHARS = 64 * 1024;

export const FRAME_ACTION_MAX_CHARS = 16 * 1024;

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const MAX_ID = 200;
const MAX_ACTION_TYPE = 120;

function jsonChars(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const clipped = (max: number) => z.string().transform(s => s.trim().slice(0, max));

const widgetSchema = z.record(z.string(), z.unknown())
  .refine(w => typeof w.type === 'string' && w.type !== '', { message: 'widget needs a type' })
  .refine(w => jsonChars(w) <= FRAME_MAX_CHARS, { message: `widget is larger than ${FRAME_MAX_CHARS} characters` });

export const frameContentSchema = z.object({
  title: clipped(MAX_TITLE).optional(),
  description: clipped(MAX_DESCRIPTION).optional(),
  widget: widgetSchema,
});

export type FrameContent = z.infer<typeof frameContentSchema>;

export const frameActionSchema = z.object({
  frameId: z.string().min(1).max(MAX_ID),
  action: z.object({
    type: z.string().min(1).max(MAX_ACTION_TYPE),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  label: clipped(MAX_TITLE).optional(),
}).refine(a => jsonChars(a) <= FRAME_ACTION_MAX_CHARS, { message: 'frame action is too large' });

export type FrameActionContent = z.infer<typeof frameActionSchema>;
