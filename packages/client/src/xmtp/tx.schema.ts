/**
 * @file Zod boundary schemas (with field/size caps) for the in-chat walletSendCalls and transactionReference wire bodies.
 */
/**
 * Zod boundary schemas for the in-chat transaction wire bodies
 *  (`xmtp.org/walletSendCalls:1.0` + `xmtp.org/transactionReference:1.0`).
 *
 *  SECURITY: a walletSendCalls request arrives over XMTP from an UNTRUSTED peer
 *  and, once approved, broadcasts a real transaction. Pairing these schemas with
 *  `decodeJsonContent(bytes, schema)` makes a malformed / hostile body throw at
 *  the codec boundary (rendered as an unsupported bubble) instead of an `as`-cast
 *  handing the pay path a wrong-but-typed object. Field counts + string sizes are
 *  capped so a peer can't ship a pathological calls[] blob. The actual to/amount
 *  shown on the confirm sheet is still re-derived from the call BYTES
 *  (txConfirm.ts) — this layer only guarantees a well-formed, bounded shape.
 */

import { z } from 'zod';
import type { ZodType } from 'zod';
import type { WalletSendCallsContent, TransactionReferenceContent } from './tx';

const MAX_STR = 16_384;   // calldata hex can be large (batched calls)
const MAX_CALLS = 32;     // EIP-5792 batch size cap
const MAX_META_KEYS = 32; // metadata is display-hints only

const hexish = z.string().max(MAX_STR);

/** Per-call metadata is display hints only (never trusted for to/amount), so we keep values loose but bound the key count + any string. */
const callMetadataSchema = z.object({
  description: z.string().max(MAX_STR).optional(),
  transactionType: z.string().max(256).optional(),
  currency: z.string().max(256).optional(),
  amount: z.number().optional(),
  decimals: z.number().optional(),
  toAddress: z.string().max(256).optional(),
}).catchall(z.unknown()).refine(
  m => Object.keys(m).length <= MAX_META_KEYS,
  { message: `too many metadata keys (>${MAX_META_KEYS})` },
);

const callSchema = z.object({
  to: hexish.optional(),
  data: hexish.optional(),
  value: hexish.optional(),
  gas: hexish.optional(),
  metadata: callMetadataSchema.optional(),
});

/** WalletSendCalls (EIP-5792) request wire schema. */
export const walletSendCallsSchema: ZodType<WalletSendCallsContent> = z.object({
  version: z.string().max(64),
  chainId: z.string().max(64),
  from: z.string().max(256),
  calls: z.array(callSchema).min(1).max(MAX_CALLS),
});

const txMetadataSchema = z.object({
  transactionType: z.string().max(256).optional(),
  currency: z.string().max(256).optional(),
  amount: z.number().optional(),
  decimals: z.number().optional(),
  fromAddress: z.string().max(256).optional(),
  toAddress: z.string().max(256).optional(),
}).catchall(z.unknown()).refine(
  m => Object.keys(m).length <= MAX_META_KEYS,
  { message: `too many metadata keys (>${MAX_META_KEYS})` },
);

/** TransactionReference (receipt) wire schema. `networkId` is a number or a hex/decimal string per the spec. */
export const transactionReferenceSchema: ZodType<TransactionReferenceContent> = z.object({
  networkId: z.union([z.number(), z.string().max(64)]),
  reference: z.string().min(1).max(MAX_STR),
  metadata: txMetadataSchema.optional(),
});
