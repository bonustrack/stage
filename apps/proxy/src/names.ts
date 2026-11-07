import { isAddress, type Hex } from 'viem';
import { claimIsFresh, claimMessage, describeLabelProblem, stageNameOf, validateStageLabel } from '@stage-labs/client/identity/stageNames';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { isMailboxLabel } from '@stage-labs/client/mail/mailbox';
import { mailboxStub, saveMailKey } from './mailBox.ts';
import {
  NAME_CLAIM_REQUEST,
  NAME_TAKEN,
  type NameCheckReply,
  type NameClaimBody,
  type NameClaimReply,
  type NameResolveReply,
  type NameStatusReply,
} from '@stage-labs/client/identity/namesApi';
import { makeNamesChain, NameTransactionRevertedError } from './namesChain.ts';
import type { NamesChain, NamesDeps, NamesStore } from './namesTypes.ts';
import { CLAIMS_OBJECT_NAME, claimsStore, serialized } from './namesClaims.ts';
import { CLIENT_CORS, guarded, repliesWith } from './respond.ts';
import { sleep } from '@stage-labs/client/timing';
import { PROXY_ROUTES, namesPath, type NamesOp } from '@stage-labs/client/endpoints';

const NAMES_PREFIX = PROXY_ROUTES.names;

export interface NamesEnv {
  NAMES_OPERATOR_KEY?: string;
  NAMES_RPC_URL?: string;
  NAMES_KV?: KVNamespace;
  NAMES_CLAIMS?: DurableObjectNamespace;
  MAIL_BOXES?: DurableObjectNamespace;
}

const addressKey = (address: string): string => `addr:${address.toLowerCase()}`;
const labelKey = (label: string): string => `label:${label}`;
const pendingKey = (label: string): string => `pending:${label}`;

const { json: reply, fail } = repliesWith(CLIENT_CORS);

async function status(url: URL, deps: NamesDeps): Promise<Response> {
  const address = url.searchParams.get('address') ?? '';
  if (!isAddress(address, { strict: false })) return fail(400, 'address required');
  const label = await deps.store.get(addressKey(address));
  if (label !== null && (await deps.store.get(pendingKey(label))) !== null) {
    const owner = await deps.chain.subnameOwner(label);
    if (owner?.toLowerCase() !== address.toLowerCase()) return reply({ name: null } satisfies NameStatusReply);
  }
  return reply({ name: label ? stageNameOf(label) : null } satisfies NameStatusReply);
}

async function resolve(url: URL, deps: NamesDeps): Promise<Response> {
  const label = (url.searchParams.get('label') ?? '').toLowerCase();
  if (validateStageLabel(label)) return fail(400, 'invalid label');
  const owner = await deps.chain.subnameOwner(label);
  const pending = (await deps.store.get(pendingKey(label))) !== null;
  const address = owner ?? (pending ? null : await deps.store.get(labelKey(label)));
  return reply({ address: address ? address.toLowerCase() : null } satisfies NameResolveReply);
}

async function check(url: URL, deps: NamesDeps): Promise<Response> {
  const label = (url.searchParams.get('label') ?? '').toLowerCase();
  const problem = validateStageLabel(label);
  if (problem) return reply({ valid: false, available: false, reason: describeLabelProblem(problem) } satisfies NameCheckReply);
  const taken = (await deps.chain.subnameOwner(label)) !== null || (await deps.store.get(labelKey(label))) !== null;
  return reply({ valid: true, available: !taken } satisfies NameCheckReply);
}

function claimRefused(error: string, status: number): Response {
  return reply({ error } satisfies NameClaimReply, status);
}

async function rejectClaim(claim: NameClaimBody, deps: NamesDeps): Promise<Response | null> {
  const now = (deps.now ?? Date.now)();
  const problem = validateStageLabel(claim.label);
  if (problem) return claimRefused(describeLabelProblem(problem), 400);
  if (!claimIsFresh(claim.issuedAt, now)) return claimRefused('claim expired, sign it again', 400);
  const heldName = await deps.store.get(addressKey(claim.address));
  if (heldName !== null && heldName !== claim.label) return claimRefused('this address already has a name', 409);
  if (!(await deps.chain.verifyClaim(claim.address, claimMessage(claim), claim.signature))) return claimRefused('invalid signature', 401);
  return unavailableReply(claim, deps);
}

async function unavailableReply(claim: NameClaimBody, deps: NamesDeps): Promise<Response | null> {
  const owner = await deps.chain.subnameOwner(claim.label);
  if (owner !== null && owner.toLowerCase() !== claim.address.toLowerCase()) return claimRefused(NAME_TAKEN, 409);
  const reservedBy = (await deps.store.get(labelKey(claim.label))) ?? (await deps.store.get(pendingKey(claim.label)));
  return reservedBy !== null && reservedBy !== claim.address.toLowerCase() ? claimRefused(NAME_TAKEN, 409) : null;
}

async function releaseReservation(body: NameClaimBody, deps: NamesDeps): Promise<void> {
  if ((await deps.store.get(labelKey(body.label))) === body.address.toLowerCase()) await deps.store.put(labelKey(body.label), '');
  if ((await deps.store.get(addressKey(body.address))) === body.label) await deps.store.put(addressKey(body.address), '');
  await deps.store.put(pendingKey(body.label), '');
}

const transactionKey = (label: string): string => `tx:${label}`;

async function issueName(body: NameClaimBody, deps: NamesDeps): Promise<Hex | Response> {
  try {
    const pending = await deps.store.get(transactionKey(body.label));
    if (pending !== null && !/^0x[0-9a-fA-F]{64}$/.test(pending)) throw new Error('The pending name transaction cannot be confirmed yet.');
    if (pending === null) await deps.store.put(transactionKey(body.label), 'unknown');
    const txHash =
      pending === null
        ? await deps.chain.issue(body.label, body.address, (hash) => deps.store.put(transactionKey(body.label), hash))
        : await deps.chain.confirm(pending as Hex);
    await deps.store.put(transactionKey(body.label), '');
    await deps.store.put(pendingKey(body.label), '');
    return txHash;
  } catch (err) {
    const taken = err instanceof Error && err.message === NAME_TAKEN;
    if (taken || err instanceof NameTransactionRevertedError) {
      await releaseReservation(body, deps);
      await deps.store.put(transactionKey(body.label), '');
    }
    if (taken) return claimRefused(NAME_TAKEN, 409);
    console.error('names claim could not be confirmed');
    return claimRefused('registration could not be confirmed, try again to check it', 502);
  }
}

const MAIL_KEY_ATTEMPTS = 3;
const MAIL_KEY_RETRY_MS = 250;

async function savedWithRetries(save: () => Promise<number>, wait: (ms: number) => Promise<void>): Promise<boolean> {
  for (let attempt = 1; attempt <= MAIL_KEY_ATTEMPTS; attempt++) {
    const status = await save().catch(() => 0);
    if (status === 204 || status === 409) return true;
    if (attempt < MAIL_KEY_ATTEMPTS) await wait(MAIL_KEY_RETRY_MS);
  }
  return false;
}

async function saveClaimedMailKey(body: NameClaimBody, deps: NamesDeps): Promise<{ mailKey?: 'stored' | 'failed' }> {
  const { mailKey: publicKey, label } = body;
  const { mailbox } = deps;
  if (publicKey === undefined || !isMailboxLabel(label)) return {};
  const key = { publicKey, owner: body.address.toLowerCase(), issuedAt: body.issuedAt };
  const wait = deps.sleep ?? sleep;
  if (mailbox !== undefined && (await savedWithRetries(() => saveMailKey(mailbox(label), key), wait))) return { mailKey: 'stored' };
  console.error('names claim: mail key not stored', label);
  return { mailKey: 'failed' };
}

async function claim(request: Request, deps: NamesDeps): Promise<Response> {
  const parsed = NAME_CLAIM_REQUEST.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return claimRefused('label, address, issuedAt and signature required', 400);
  const body = parsed.data;
  const rejection = await rejectClaim(body, deps);
  if (rejection) return rejection;
  await deps.store.put(pendingKey(body.label), body.address.toLowerCase());
  await deps.store.put(labelKey(body.label), body.address.toLowerCase());
  await deps.store.put(addressKey(body.address), body.label);
  if ((await deps.chain.subnameOwner(body.label))?.toLowerCase() === body.address.toLowerCase()) {
    await deps.store.put(transactionKey(body.label), '');
    await deps.store.put(pendingKey(body.label), '');
    return reply({ name: stageNameOf(body.label), alreadyOwned: true, ...(await saveClaimedMailKey(body, deps)) } satisfies NameClaimReply);
  }
  const txHash = await issueName(body, deps);
  if (txHash instanceof Response) return txHash;
  return reply({ name: stageNameOf(body.label), txHash, ...(await saveClaimedMailKey(body, deps)) } satisfies NameClaimReply);
}

type NamesHandler = (request: Request, deps: NamesDeps) => Promise<Response>;

const ROUTES: Readonly<Record<string, NamesHandler | undefined>> = {
  'GET status': (request, deps) => status(new URL(request.url), deps),
  'GET check': (request, deps) => check(new URL(request.url), deps),
  'GET resolve': (request, deps) => resolve(new URL(request.url), deps),
  'POST claim': claim,
} satisfies Partial<Record<`${'GET' | 'POST'} ${NamesOp}`, NamesHandler>>;

async function route(request: Request, deps: NamesDeps): Promise<Response> {
  const handler = ROUTES[`${request.method} ${new URL(request.url).pathname.slice(NAMES_PREFIX.length)}`];
  return handler === undefined ? fail(404, 'not found') : handler(request, deps);
}

export async function handleNames(request: Request, deps: NamesDeps): Promise<Response> {
  return await guarded(
    () => route(request, deps),
    (err) => {
      const detail = err instanceof Error ? (err.message.split('\n')[0] ?? 'unknown error') : String(err);
      return fail(502, `name service error: ${detail}`);
    },
  );
}

function kvStore(kv: KVNamespace): NamesStore {
  return {
    get: async (key) => {
      const value = await kv.get(key);
      return value === null || value === '' ? null : value;
    },
    put: (key, value) => kv.put(key, value),
  };
}

let chain: NamesChain | null = null;

export function configuredChain(env: NamesEnv): NamesChain | null {
  if (!env.NAMES_OPERATOR_KEY) return null;
  chain ??= makeNamesChain(env.NAMES_OPERATOR_KEY as Hex, env.NAMES_RPC_URL ?? broviderRpc(8453));
  return chain;
}

const NOT_CONFIGURED = (): Response => fail(503, 'name registration is not configured');

export function handleNamesRequest(request: Request, env: NamesEnv): Promise<Response> {
  const namesChain = configuredChain(env);
  if (!namesChain || !env.NAMES_KV || !env.NAMES_CLAIMS) return Promise.resolve(NOT_CONFIGURED());
  const isClaim = new URL(request.url).pathname === namesPath('claim') && request.method === 'POST';
  if (isClaim) return env.NAMES_CLAIMS.get(env.NAMES_CLAIMS.idFromName(CLAIMS_OBJECT_NAME)).fetch(request);
  return handleNames(request, { chain: namesChain, store: kvStore(env.NAMES_KV) });
}

export class NamesClaims {
  private readonly handle: (request: Request) => Promise<Response>;

  constructor(state: DurableObjectState, env: NamesEnv) {
    this.handle = serialized((request) => {
      const namesChain = configuredChain(env);
      if (!namesChain || !env.NAMES_KV) return Promise.resolve(NOT_CONFIGURED());
      const boxes = env.MAIL_BOXES;
      const mailbox = boxes === undefined ? undefined : (label: string) => mailboxStub(boxes, label);
      return handleNames(request, { chain: namesChain, store: claimsStore(state.storage, kvStore(env.NAMES_KV)), mailbox });
    });
  }

  fetch(request: Request): Promise<Response> {
    return this.handle(request);
  }
}
