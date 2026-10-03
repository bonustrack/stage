import type { Hex } from 'viem';
import { claimIsFresh } from '@stage-labs/client/identity/stageNames';
import {
  isMailboxLabel, isMailId, isMailPublicKey, mailAddressOf, mailRegisterMessage, mailSessionMessage,
} from '@stage-labs/client/mail/mailbox';
import type { ArchiveStub } from './historyStore.ts';
import { mailboxCall, readMailKey, saveMailKey } from './mailBox.ts';
import { corsHeaders, corsResponse, jsonResponse } from './respond.ts';

export const MAIL_PREFIX = '/mail/';

const CORS = corsHeaders('GET, POST, DELETE, OPTIONS', 'content-type, authorization');
const SIGNATURE = /^0x[0-9a-fA-F]+$/;

export interface MailChain {
  owner(label: string): Promise<Hex | null>;
  verify(address: Hex, message: string, signature: Hex): Promise<boolean>;
}

interface RequestLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface MailDeps {
  mailbox: (label: string) => ArchiveStub;
  chain: MailChain;
  limiter?: RequestLimiter;
  clientIp: string;
  now?: () => number;
}

type Fields = Record<string, unknown>;
type Handler = (request: Request, deps: MailDeps) => Promise<Response>;
interface Access { stub: ArchiveStub; owner: string; id: string }

const reply = (body: unknown, status = 200): Response => jsonResponse(body, status, CORS);
const fail = (status: number, error: string): Response => reply({ error }, status);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const isSignature = (value: string): value is Hex => SIGNATURE.test(value);

async function readFields(request: Request): Promise<Fields> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null ? (body as Fields) : {};
}

async function verifiedOwner(deps: MailDeps, label: string, message: string, signature: Hex): Promise<Hex | Response> {
  const owner = await deps.chain.owner(label);
  if (owner === null) return fail(404, 'no such name');
  if (!(await deps.chain.verify(owner, message, signature))) return fail(401, 'invalid signature');
  return owner;
}

interface KeyClaim { label: string; publicKey: Hex; issuedAt: number; signature: Hex }

function parseKeyClaim(body: Fields): KeyClaim | null {
  const label = text(body.label).toLowerCase();
  const publicKey = text(body.publicKey).toLowerCase();
  const signature = text(body.signature);
  const { issuedAt } = body;
  if (!isMailboxLabel(label) || !isMailPublicKey(publicKey) || !isSignature(signature) || typeof issuedAt !== 'number') return null;
  return { label, publicKey, issuedAt, signature };
}

const registerKey: Handler = async (request, deps) => {
  const claim = parseKeyClaim(await readFields(request));
  if (claim === null) return fail(400, 'label, publicKey, issuedAt and signature required');
  const { label, publicKey, issuedAt, signature } = claim;
  if (!claimIsFresh(issuedAt, (deps.now ?? Date.now)())) return fail(400, 'registration expired, sign it again');
  const owner = await verifiedOwner(deps, label, mailRegisterMessage({ label, publicKey, issuedAt }), signature);
  if (owner instanceof Response) return owner;
  const stored = await saveMailKey(deps.mailbox(label), { publicKey, owner: owner.toLowerCase(), issuedAt });
  if (stored === 409) return fail(409, 'a newer key is already registered');
  if (stored !== 204) return fail(502, 'could not store the key');
  return reply({ address: mailAddressOf(label) });
};

const keyStatus: Handler = async (request, deps) => {
  const label = (new URL(request.url).searchParams.get('label') ?? '').toLowerCase();
  if (!isMailboxLabel(label)) return fail(400, 'label required');
  const owner = await deps.chain.owner(label);
  if (owner === null) return fail(404, 'no such name');
  const key = await readMailKey(deps.mailbox(label));
  const active = key !== null && key.owner === owner.toLowerCase() && isMailPublicKey(key.publicKey);
  return reply({ address: mailAddressOf(label), owner: owner.toLowerCase(), publicKey: active ? key.publicKey : null });
};

const challenge: Handler = async (request, deps) => {
  const label = text((await readFields(request)).label).toLowerCase();
  if (!isMailboxLabel(label)) return fail(400, 'label required');
  if ((await deps.chain.owner(label)) === null) return fail(404, 'no such name');
  const issued = await mailboxCall(deps.mailbox(label), 'challenge');
  if (!issued.ok) return fail(502, 'could not start a sign-in');
  return reply(await issued.json());
};

const openSession: Handler = async (request, deps) => {
  const body = await readFields(request);
  const label = text(body.label).toLowerCase();
  const nonce = text(body.nonce);
  const signature = text(body.signature);
  if (!isMailboxLabel(label) || !isSignature(signature)) return fail(400, 'label, nonce and signature required');
  const stub = deps.mailbox(label);
  const [consumed, owner] = await Promise.all([mailboxCall(stub, 'consume', { nonce }), deps.chain.owner(label)]);
  if (!consumed.ok) return fail(401, 'sign-in expired, start again');
  const { expiresAt } = (await consumed.json()) as { expiresAt: number };
  if (owner === null) return fail(404, 'no such name');
  if (!(await deps.chain.verify(owner, mailSessionMessage({ label, nonce, expiresAt }), signature))) return fail(401, 'invalid signature');
  const session = await mailboxCall(stub, 'session', { owner: owner.toLowerCase() });
  return session.ok ? reply(await session.json()) : fail(502, 'could not open a session');
};

async function access(request: Request, deps: MailDeps): Promise<Access | Response> {
  const params = new URL(request.url).searchParams;
  const label = (params.get('label') ?? '').toLowerCase();
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!isMailboxLabel(label)) return fail(400, 'label required');
  if (token === '') return fail(401, 'sign in first');
  const stub = deps.mailbox(label);
  const [auth, current] = await Promise.all([mailboxCall(stub, 'auth', { token }), deps.chain.owner(label)]);
  if (!auth.ok) return fail(401, 'session expired, sign in again');
  const { owner } = (await auth.json()) as { owner: string };
  if (current === null || current.toLowerCase() !== owner) return fail(403, 'this name has a new owner');
  return { stub, owner, id: params.get('id') ?? '' };
}

function withAccess(run: (granted: Access) => Promise<Response>, needsId = false): Handler {
  return async (request, deps) => {
    const granted = await access(request, deps);
    if (granted instanceof Response) return granted;
    if (needsId && !isMailId(granted.id)) return fail(400, 'id required');
    return run(granted);
  };
}

function ownerMismatch(found: Response, current: Hex | null): Response | null {
  if (found.status === 401) return fail(401, 'session expired, sign in again');
  const owner = found.headers.get('x-mail-owner');
  return current !== null && owner !== null && current.toLowerCase() === owner ? null : fail(403, 'this name has a new owner');
}

async function signedRead(request: Request, deps: MailDeps, op: string, needsId: boolean): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const label = (params.get('label') ?? '').toLowerCase();
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const id = params.get('id') ?? '';
  if (!isMailboxLabel(label)) return fail(400, 'label required');
  if (token === '') return fail(401, 'sign in first');
  const [found, current] = await Promise.all([mailboxCall(deps.mailbox(label), op, { token, id }), deps.chain.owner(label)]);
  const denied = ownerMismatch(found, current);
  if (denied !== null) return denied;
  return needsId && !isMailId(id) ? fail(400, 'id required') : found;
}

const listMail: Handler = async (request, deps) => {
  const found = await signedRead(request, deps, 'signedList', false);
  return found.headers.has('x-mail-owner') ? reply(await found.json()) : found;
};

const readMail: Handler = async (request, deps) => {
  const found = await signedRead(request, deps, 'signedRead', true);
  if (!found.headers.has('x-mail-owner')) return found;
  return found.ok ? corsResponse(CORS, found.body, 200, 'application/octet-stream') : fail(404, 'no such mail');
};

const deleteMail = withAccess(async ({ stub, owner, id }) => {
  const removed = await mailboxCall(stub, 'delete', { owner, id });
  return removed.ok ? corsResponse(CORS, null, 204) : fail(404, 'no such mail');
}, true);

const closeBox = withAccess(async ({ stub, owner }) => {
  await mailboxCall(stub, 'close', { owner });
  return corsResponse(CORS, null, 204);
});

const ROUTES: Record<string, Handler> = {
  'POST key': registerKey,
  'GET key': keyStatus,
  'POST challenge': challenge,
  'POST session': openSession,
  'GET list': listMail,
  'GET message': readMail,
  'DELETE message': deleteMail,
  'DELETE box': closeBox,
};

export async function handleMail(request: Request, deps: MailDeps): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(CORS, null, 204);
  const handler = ROUTES[`${request.method} ${new URL(request.url).pathname.slice(MAIL_PREFIX.length)}`];
  if (handler === undefined) return fail(404, 'not found');
  if (deps.limiter !== undefined && !(await deps.limiter.limit({ key: deps.clientIp })).success) {
    return fail(429, 'too many requests');
  }
  try {
    return await handler(request, deps);
  } catch {
    return fail(502, 'mail service error');
  }
}
