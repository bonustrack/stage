import { z } from 'zod';
import { parseOrThrow } from '../validate';

export const PINEAPPLE_UPLOAD_URL = 'https://pineapple.fyi/upload';

const responseSchema = z.object({ result: z.object({ cid: z.string().regex(/^[a-zA-Z0-9]+$/) }) });
const errorSchema = z.object({ error: z.object({ message: z.string().min(1) }) });

export function parsePineappleResponse(json: unknown): string {
  const failure = errorSchema.safeParse(json);
  if (failure.success) throw new Error(failure.data.error.message);
  const parsed = parseOrThrow('avatar upload', responseSchema, json);
  return `ipfs://${parsed.result.cid}`;
}
