/** @file Zod boundary schemas (field/size capped) for the in-chat walletSendCalls + transactionReference wire bodies: a walletSendCalls request arrives from an UNTRUSTED peer and, once approved, broadcasts a real tx, so a malformed/hostile body throws at the codec boundary instead of `as`-casting a wrong-but-typed object into the pay path. */

import { z } from 'zod';
import type { ZodType } from 'zod';
import type { WalletSendCallsContent, TransactionReferenceContent } from './tx';

const MAX_STR = 16_384;   /** calldata hex can be large (batched calls) */
const MAX_CALLS = 32;     /** EIP-5792 batch size cap */
const MAX_META_KEYS = 32; /** metadata is display-hints only */

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
