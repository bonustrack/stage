import { isAddress, type Hex } from 'viem';
import {
  claimIsFresh, claimMessage, describeLabelProblem, stageNameOf, validateStageLabel,
} from '@stage-labs/client/identity/stageNames';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { makeNamesChain } from './namesChain.ts';
import type { NamesChain, NamesDeps, NamesStore } from './namesTypes.ts';
import { CLAIMS_OBJECT_NAME, claimsStore, serialized } from './namesClaims.ts';
import { corsHeaders, corsResponse, jsonResponse } from './respond.ts';

export const NAMES_PREFIX = '/names/';

export interface NamesEnv {
  NAMES_OPERATOR_KEY?: string;
  NAMES_RPC_URL?: string;
  NAMES_KV?: KVNamespace;
  NAMES_CLAIMS?: DurableObjectNamespace;
}

const CORS = corsHeaders('GET, POST, OPTIONS', 'content-type, x-stage-client');

const addressKey = (address: string): string => `addr:${address.toLowerCase()}`;
const labelKey = (label: string): string => `label:${label}`;

function reply(body: unknown, status = 200): Response {
  return jsonResponse(body, status, CORS);
}

async function status(url: URL, deps: NamesDeps): Promise<Response> {
  const address = url.searchParams.get('address') ?? '';
  if (!isAddress(address, { strict: false })) return reply({ error: 'address required' }, 400);
  const label = await deps.store.get(addressKey(address));
  return reply({ name: label ? stageNameOf(label) : null });
}

async function resolve(url: URL, deps: NamesDeps): Promise<Response> {
  const label = (url.searchParams.get('label') ?? '').toLowerCase();
  if (validateStageLabel(label)) return reply({ error: 'invalid label' }, 400);
  const owner = await deps.chain.subnameOwner(label);
  const address = owner ?? (await deps.store.get(labelKey(label))) ?? null;
  return reply({ address: address ? address.toLowerCase() : null });
}

async function check(url: URL, deps: NamesDeps): Promise<Response> {
  const label = (url.searchParams.get('label') ?? '').toLowerCase();
  const problem = validateStageLabel(label);
  if (problem) return reply({ valid: false, available: false, reason: describeLabelProblem(problem) });
  const taken = (await deps.chain.subnameOwner(label)) !== null || (await deps.store.get(labelKey(label))) !== null;
  return reply({ valid: true, available: !taken });
}

interface ClaimBody { label: string; address: Hex; issuedAt: number; signature: Hex }

function parseClaim(raw: unknown): ClaimBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { label, address, issuedAt, signature } = raw as Record<string, unknown>;
  if (typeof label !== 'string' || typeof address !== 'string' || typeof signature !== 'string') return null;
  if (typeof issuedAt !== 'number' || !isAddress(address, { strict: false }) || !/^0x[0-9a-fA-F]+$/.test(signature)) return null;
  return { label: label.toLowerCase(), address, issuedAt, signature: signature as Hex };
}

const NAME_TAKEN = 'name already taken';

async function rejectClaim(claim: ClaimBody, deps: NamesDeps): Promise<Response | null> {
  const now = (deps.now ?? Date.now)();
  const problem = validateStageLabel(claim.label);
  if (problem) return reply({ error: describeLabelProblem(problem) }, 400);
  if (!claimIsFresh(claim.issuedAt, now)) return reply({ error: 'claim expired, sign it again' }, 400);
  const heldName = await deps.store.get(addressKey(claim.address));
  if (heldName !== null && heldName !== claim.label) return reply({ error: 'this address already has a name' }, 409);
  const message = claimMessage({ label: claim.label, address: claim.address, issuedAt: claim.issuedAt });
  if (!(await deps.chain.verifyClaim(claim.address, message, claim.signature))) return reply({ error: 'invalid signature' }, 401);
  return unavailableReply(claim, deps);
}

async function unavailableReply(claim: ClaimBody, deps: NamesDeps): Promise<Response | null> {
  const owner = await deps.chain.subnameOwner(claim.label);
  if (owner !== null) {
    const own = owner.toLowerCase() === claim.address.toLowerCase();
    return reply({ error: own ? 'this address already has a name' : NAME_TAKEN }, 409);
  }
  const reservedBy = await deps.store.get(labelKey(claim.label));
  return reservedBy !== null && reservedBy !== claim.address.toLowerCase() ? reply({ error: NAME_TAKEN }, 409) : null;
}

async function releaseReservation(body: ClaimBody, deps: NamesDeps): Promise<void> {
  if ((await deps.store.get(labelKey(body.label))) === body.address.toLowerCase()) await deps.store.put(labelKey(body.label), '');
  if ((await deps.store.get(addressKey(body.address))) === body.label) await deps.store.put(addressKey(body.address), '');
}

async function claim(request: Request, deps: NamesDeps): Promise<Response> {
  const body = parseClaim(await request.json().catch(() => null));
  if (!body) return reply({ error: 'label, address, issuedAt and signature required' }, 400);
  const rejection = await rejectClaim(body, deps);
  if (rejection) return rejection;
  await deps.store.put(labelKey(body.label), body.address.toLowerCase());
  await deps.store.put(addressKey(body.address), body.label);
  try {
    const txHash = await deps.chain.issue(body.label, body.address);
    return reply({ name: stageNameOf(body.label), txHash });
  } catch (err) {
    await releaseReservation(body, deps);
    if (err instanceof Error && err.message === NAME_TAKEN) return reply({ error: NAME_TAKEN }, 409);
    console.error('names claim failed', err);
    return reply({ error: 'registration failed, try again' }, 502);
  }
}

async function route(request: Request, deps: NamesDeps): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(NAMES_PREFIX.length);
  if (path === 'status' && request.method === 'GET') return status(url, deps);
  if (path === 'check' && request.method === 'GET') return check(url, deps);
  if (path === 'resolve' && request.method === 'GET') return resolve(url, deps);
  if (path === 'claim' && request.method === 'POST') return claim(request, deps);
  return reply({ error: 'not found' }, 404);
}

export async function handleNames(request: Request, deps: NamesDeps): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(CORS, null, 204);
  try {
    return await route(request, deps);
  } catch (err) {
    const detail = err instanceof Error ? err.message.split('\n')[0] ?? 'unknown error' : String(err);
    return reply({ error: `name service error: ${detail}` }, 502);
  }
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

function configuredChain(env: NamesEnv): NamesChain | null {
  if (!env.NAMES_OPERATOR_KEY) return null;
  chain ??= makeNamesChain(env.NAMES_OPERATOR_KEY as Hex, env.NAMES_RPC_URL ?? broviderRpc(8453));
  return chain;
}

const NOT_CONFIGURED = (): Response => reply({ error: 'name registration is not configured' }, 503);

export function handleNamesRequest(request: Request, env: NamesEnv): Promise<Response> {
  const namesChain = configuredChain(env);
  if (!namesChain || !env.NAMES_KV || !env.NAMES_CLAIMS) return Promise.resolve(NOT_CONFIGURED());
  const isClaim = new URL(request.url).pathname === `${NAMES_PREFIX}claim` && request.method === 'POST';
  if (isClaim) return env.NAMES_CLAIMS.get(env.NAMES_CLAIMS.idFromName(CLAIMS_OBJECT_NAME)).fetch(request);
  return handleNames(request, { chain: namesChain, store: kvStore(env.NAMES_KV) });
}

export class NamesClaims {
  private readonly handle: (request: Request) => Promise<Response>;

  constructor(state: DurableObjectState, env: NamesEnv) {
    this.handle = serialized((request) => {
      const namesChain = configuredChain(env);
      if (!namesChain || !env.NAMES_KV) return Promise.resolve(NOT_CONFIGURED());
      return handleNames(request, { chain: namesChain, store: claimsStore(state.storage, kvStore(env.NAMES_KV)) });
    });
  }

  fetch(request: Request): Promise<Response> {
    return this.handle(request);
  }
}
