/** @file Zod boundary schemas with field/size caps for the Metro in-chat signature-request and signature-reference wire bodies; pairing them with `decodeJsonContent` makes a hostile body from an untrusted peer throw loudly at the codec boundary (rendered as an unsupported bubble) and caps counts/sizes so a peer can't DoS the renderer/signer with a pathological typed-data blob. */

import { z } from 'zod';
import type { ZodType } from 'zod';
import type { SignatureRequestContent, SignatureReferenceContent } from './sign';

/** Caps — generous for any legitimate typed-data, tight enough to reject an abusive blob. A real Permit / order has a handful of types + fields. */
const MAX_STR = 8_192;          /* any single string field (message values, desc) */
const MAX_TYPE_NAMES = 64;      /* distinct struct types in `types` */
const MAX_FIELDS_PER_TYPE = 64; /* fields within one struct type */
const MAX_MESSAGE_KEYS = 128;   /* top-level keys in `message` */
const MAX_DOMAIN_KEYS = 16;     /* keys in `domain` (EIP-712 domain has <=5) */

const boundedString = z.string().max(MAX_STR);

/** A capped record: at most `maxKeys` entries, each value validated by `value`. */
function cappedRecord<V extends ZodType>(value: V, maxKeys: number) {
  return z.record(z.string().max(256), value).refine(
    r => Object.keys(r).length <= maxKeys,
    { message: `too many keys (>${maxKeys})` },
  );
}

/** One EIP-712 type field: `{ name, type }`, both bounded strings. */
const typeFieldSchema = z.object({
  name: z.string().max(256),
  type: z.string().max(256),
});

/** The standard eth_signTypedData_v4 shape: {domain, types, primaryType, message}. Values are kept as `unknown` (typed-data carries arbitrary JSON), but their CONTAINERS are bounded so a hostile blob can't explode the renderer/signer. */
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

/** SignatureRequest wire schema. `kind` is bound to the two known variants and the eip712 shape is REQUIRED when kind === 'eip712' (so the signer never gets a kind:'eip712' with no typed-data, or a typed-data it can't decode). */
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

/** SignatureReference (receipt) wire schema — a completed signature posted back. */
export const signatureReferenceSchema: ZodType<SignatureReferenceContent> = z.object({
  requestId: z.string().min(1).max(256),
  signature: z.string().min(1).max(MAX_STR),
  signer: z.string().min(1).max(256),
});
