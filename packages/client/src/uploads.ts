import { z } from 'zod';

export const UPLOAD_MAX_BYTES = 100_000_000;

export const UPLOAD_REPLY = z.object({ id: z.string().min(1) });

export type UploadReply = z.infer<typeof UPLOAD_REPLY>;
