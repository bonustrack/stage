import { z } from 'zod';
import { parseOrThrow } from '../validate';

export const X402_SETTLE_REQUEST = z.object({ url: z.string().trim().min(1), paymentHeader: z.string().trim().min(1) });

const X402_SETTLE_REPLY = z.object({ status: z.number(), ok: z.boolean(), body: z.string().optional() });

export type X402SettleRequest = z.infer<typeof X402_SETTLE_REQUEST>;

export type X402SettleResult = z.infer<typeof X402_SETTLE_REPLY>;

export function readSettleReply(raw: unknown): X402SettleResult {
  return parseOrThrow('x402 settle', X402_SETTLE_REPLY, raw);
}
