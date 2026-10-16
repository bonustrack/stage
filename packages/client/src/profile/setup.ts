import { z } from 'zod';
import type { AccountRecord } from '../accounts/types';
import { validateStageLabel } from '../identity/stageNames';
import { parseOrThrow } from '../validate';

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value as `0x${string}`);
const image = z.object({ uri: z.string().min(1), mime: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/), name: z.string().optional() }).strict();
const profile = z.object({
  label: z.string().refine(value => validateStageLabel(value) === null),
  displayName: z.string().optional(), description: z.string().optional(), image: image.optional(),
}).strict();
const account = z.object({
  id: address, address, type: z.literal('smart'), dbDir: z.string().min(1),
  registered: z.boolean().optional(), createdAt: z.number().finite(),
  hdIndex: z.number().int().nonnegative(), phraseId: z.string().min(1), ownerAddress: address,
}).strict().refine(value => value.id === value.address.toLowerCase() && value.dbDir === `xmtp-${value.id}`, 'wallet storage must match the prepared account');
const durableProfile = profile.extend({
  image: image.extend({ uri: z.string().regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$/) }).optional(),
});
const progress = z.object({
  avatar: z.string().regex(/^ipfs:\/\/[a-zA-Z0-9]+$/).optional(),
  transactions: z.array(hash).optional(),
  submitting: z.boolean().optional(),
  claiming: z.boolean().optional(),
  claimed: z.boolean().optional(),
}).strict();
const pending = z.object({
  version: z.literal(1), account: account.optional(), profile: durableProfile.optional(),
  stage: z.enum(['wallet', 'messaging', 'profile']), progress: progress.optional(),
}).strict().refine(value => (value.stage === 'wallet' || value.account !== undefined) && (value.progress === undefined || (value.account !== undefined && value.profile !== undefined)), 'setup progress must belong to a prepared account');

export type ProfileImage = z.infer<typeof image>;
export type ProfileSetup = z.infer<typeof profile>;
export type ProfileProgress = z.infer<typeof progress>;
export type PendingSetup = z.infer<typeof pending>;

const nameCheck = z.object({ valid: z.boolean(), available: z.boolean(), reason: z.string().optional() });
const nameClaim = z.object({ name: z.string().optional(), error: z.string().optional(), mailKey: z.string().optional() });
export type NameCheck = z.infer<typeof nameCheck>;
export function parseNameCheck(raw: unknown): NameCheck { return parseOrThrow('username availability', nameCheck, raw); }
export function parseNameClaim(raw: unknown): z.infer<typeof nameClaim> { return parseOrThrow('username registration', nameClaim, raw); }

function preparedIdentity(value: AccountRecord): (string | number | undefined)[] {
  return [value.id, value.address.toLowerCase(), value.type, value.dbDir, value.phraseId, value.hdIndex, value.ownerAddress?.toLowerCase()];
}
export function samePreparedAccount(left: AccountRecord, right: AccountRecord): boolean {
  const expected = preparedIdentity(right);
  return preparedIdentity(left).every((value, index) => value === expected[index]);
}

export function parsePendingSetup(raw: string): PendingSetup {
  return parseOrThrow('pending account setup', pending, JSON.parse(raw));
}
