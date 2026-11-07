import type { Hex } from 'viem';
import { z } from 'zod';
import { STAGE_CLIENT_HEADERS, namesPath, type NamesOp } from '../endpoints';
import { parseOrThrow } from '../validate';
import { stageNameOf, type ClaimRequest } from './stageNames';

export const NAME_TAKEN = 'name already taken';

export type NamesRequest = <T>(url: string, init: RequestInit, read: (response: Response) => Promise<T>) => Promise<T>;

const directRequest: NamesRequest = async (url, init, read) => read(await fetch(url, init));

const CLIENT_HEADERS = { 'content-type': 'application/json', ...STAGE_CLIENT_HEADERS };

const STATUS_REPLY = z.object({ name: z.string().min(1) });
const RESOLVE_REPLY = z.object({ address: z.string().min(1) });
const CHECK_REPLY = z.object({ valid: z.boolean(), available: z.boolean(), reason: z.string().optional() });
const CLAIM_REPLY = z.object({ name: z.string().optional(), error: z.string().optional(), mailKey: z.string().optional() });

export type NameCheck = z.infer<typeof CHECK_REPLY>;

export interface NameClaim extends ClaimRequest {
  signature: Hex;
}

export type NameClaimOutcome =
  | { kind: 'claimed'; name: string; mailKeyFailed: boolean }
  | { kind: 'taken' }
  | { kind: 'unconfirmed' }
  | { kind: 'refused'; status: number; error: string | undefined };

function namesUrl(proxyBase: string, op: NamesOp, query = ''): string {
  return `${proxyBase}${namesPath(op)}${query}`;
}

async function issuedField<T>(proxyBase: string, op: NamesOp, query: string, reply: z.ZodType<T>): Promise<T | null> {
  return directRequest(namesUrl(proxyBase, op, `?${query}`), {}, async (res) => {
    if (!res.ok) return null;
    const parsed = reply.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  });
}

export async function fetchIssuedName(proxyBase: string, address: string): Promise<string | null> {
  return (await issuedField(proxyBase, 'status', `address=${encodeURIComponent(address)}`, STATUS_REPLY))?.name ?? null;
}

export async function fetchIssuedAddress(proxyBase: string, label: string): Promise<string | null> {
  return (await issuedField(proxyBase, 'resolve', `label=${encodeURIComponent(label)}`, RESOLVE_REPLY))?.address ?? null;
}

export function fetchNameCheck(proxyBase: string, label: string, request: NamesRequest = directRequest): Promise<NameCheck> {
  return request(namesUrl(proxyBase, 'check', `?label=${encodeURIComponent(label)}`), { headers: CLIENT_HEADERS }, async (res) => {
    if (!res.ok) throw new Error(`name service responded ${res.status}`);
    return parseOrThrow('username availability', CHECK_REPLY, await res.json());
  });
}

function claimOutcome(res: Response, body: z.infer<typeof CLAIM_REPLY>, label: string): NameClaimOutcome {
  if (res.status === 409 && body.error === NAME_TAKEN) return { kind: 'taken' };
  if (!res.ok) return { kind: 'refused', status: res.status, error: body.error };
  const name = stageNameOf(label);
  if (body.name !== name) return { kind: 'unconfirmed' };
  return { kind: 'claimed', name, mailKeyFailed: body.mailKey === 'failed' };
}

export function postNameClaim(proxyBase: string, claim: NameClaim, request: NamesRequest = directRequest): Promise<NameClaimOutcome> {
  const { label, address, issuedAt, signature, mailKey } = claim;
  const init = { method: 'POST', headers: CLIENT_HEADERS, body: JSON.stringify({ label, address, issuedAt, signature, mailKey }) };
  return request(namesUrl(proxyBase, 'claim'), init, async (res) =>
    claimOutcome(res, parseOrThrow('username registration', CLAIM_REPLY, await res.json()), label),
  );
}
