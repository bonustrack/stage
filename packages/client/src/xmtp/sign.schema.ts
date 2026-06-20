
import { z } from 'zod';
import type { ZodType } from 'zod';
import type { SignatureRequestContent, SignatureReferenceContent } from './sign';

const MAX_STR = 8_192;
const MAX_TYPE_NAMES = 64;
const MAX_FIELDS_PER_TYPE = 64;
const MAX_MESSAGE_KEYS = 128;
const MAX_DOMAIN_KEYS = 16;

const boundedString = z.string().max(MAX_STR);

function cappedRecord<V extends ZodType>(value: V, maxKeys: number) {
  return z.record(z.string().max(256), value).refine(
    r => Object.keys(r).length <= maxKeys,
    { message: `too many keys (>${maxKeys})` },
  );
}

const typeFieldSchema = z.object({
  name: z.string().max(256),
  type: z.string().max(256),
});

const eip712Schema = z.object({
  domain: cappedRecord(z.unknown(), MAX_DOMAIN_KEYS),
  types: z.record(
    z.string().max(256),
    z.array(typeFieldSchema).max(MAX_FIELDS_PER_TYPE),
  ).refine(
    t => Object.keys(t).length <= MAX_TYPE_NAMES,
    { message: `too many types (>${MAX_TYPE_NAMES})` },
  ),
  primaryType: z.string().min(1).max(256),
  message: cappedRecord(z.unknown(), MAX_MESSAGE_KEYS),
});

export const signatureRequestSchema: ZodType<SignatureRequestContent> = z.object({
  id: z.string().min(1).max(256),
  kind: z.enum(['eip712', 'personal']),
  eip712: eip712Schema.optional(),
  message: boundedString.optional(),
  description: boundedString.optional(),
}).refine(
  c => (c.kind === 'eip712' ? c.eip712 != null : typeof c.message === 'string'),
  { message: 'eip712 request needs `eip712`; personal request needs `message`' },
);

export const signatureReferenceSchema: ZodType<SignatureReferenceContent> = z.object({
  requestId: z.string().min(1).max(256),
  signature: z.string().min(1).max(MAX_STR),
  signer: z.string().min(1).max(256),
});
