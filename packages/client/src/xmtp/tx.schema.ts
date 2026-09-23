
import { z } from 'zod';

const MAX_STR = 16_384;
const MAX_CALLS = 32;
const MAX_META_KEYS = 32;

const hexish = z.string().max(MAX_STR);

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

export const walletSendCallsSchema = z.object({
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

export const transactionReferenceSchema = z.object({
  networkId: z.union([z.number(), z.string().max(64)]),
  reference: z.string().min(1).max(MAX_STR),
  metadata: txMetadataSchema.optional(),
});

export type WalletSendCallsContent = z.infer<typeof walletSendCallsSchema>;
export type TransactionReferenceContent = z.infer<typeof transactionReferenceSchema>;
