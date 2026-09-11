import { isAddress, type Hex } from 'viem';
import {
  claimIsFresh, claimMessage, describeLabelProblem, stageNameOf, validateStageLabel,
} from '@stage-labs/client/identity/stageNames';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { makeNamesChain } from './namesChain.ts';
import type { NamesChain, NamesDeps, NamesStore } from './namesTypes.ts';

export type { NamesChain, NamesDeps, NamesStore } from './namesTypes.ts';

export const NAMES_PREFIX = '/names/';

export interface NamesEnv {
  NAMES_OPERATOR_KEY?: string;
  NAMES_KV?: KVNamespace;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-stage-client',
  'access-control-max-age': '86400',
  'x-served-by': 'worker',
};

const addressKey = (address: string): string => `addr:${address.toLowerCase()}`;
const labelKey = (label: string): string => `label:${label}`;

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });
}

async function status(url: URL, deps: NamesDeps): Promise<Response> {
  const address = url.searchParams.get('address') ?? '';
  if (!isAddress(address, { strict: false })) return reply({ error: 'address required' }, 400);
  const label = await deps.store.get(addressKey(address));
  return reply({ name: label ? stageNameOf(label) : null });
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

async function rejectClaim(claim: ClaimBody, deps: NamesDeps): Promise<Response | null> {
  const now = (deps.now ?? Date.now)();
  const problem = validateStageLabel(claim.label);
  if (problem) return reply({ error: describeLabelProblem(problem) }, 400);
  if (!claimIsFresh(claim.issuedAt, now)) return reply({ error: 'claim expired, sign it again' }, 400);
  if (await deps.store.get(addressKey(claim.address))) return reply({ error: 'this address already has a name' }, 409);
  const message = claimMessage({ label: claim.label, address: claim.address, issuedAt: claim.issuedAt });
  if (!(await deps.chain.verifyClaim(claim.address, message, claim.signature))) return reply({ error: 'invalid signature' }, 401);
  if ((await deps.chain.subnameOwner(claim.label)) !== null || (await deps.store.get(labelKey(claim.label))) !== null) {
    return reply({ error: 'name already taken' }, 409);
  }
  return null;
}

async function claim(request: Request, deps: NamesDeps): Promise<Response> {
  const body = parseClaim(await request.json().catch(() => null));
  if (!body) return reply({ error: 'label, address, issuedAt and signature required' }, 400);
  const rejection = await rejectClaim(body, deps);
  if (rejection) return rejection;
  await deps.store.put(labelKey(body.label), body.address.toLowerCase());
  try {
    const txHash = await deps.chain.issue(body.label, body.address);
    await deps.store.put(addressKey(body.address), body.label);
    return reply({ name: stageNameOf(body.label), txHash });
  } catch (err) {
    await deps.store.put(labelKey(body.label), '');
    return reply({ error: err instanceof Error ? err.message : 'registration failed' }, 502);
  }
}

export async function handleNames(request: Request, deps: NamesDeps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const route = url.pathname.slice(NAMES_PREFIX.length);
  if (route === 'status' && request.method === 'GET') return status(url, deps);
  if (route === 'check' && request.method === 'GET') return check(url, deps);
  if (route === 'claim' && request.method === 'POST') return claim(request, deps);
  return reply({ error: 'not found' }, 404);
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

export function handleNamesRequest(request: Request, env: NamesEnv): Promise<Response> {
  if (!env.NAMES_OPERATOR_KEY || !env.NAMES_KV) {
    return Promise.resolve(reply({ error: 'name registration is not configured' }, 503));
  }
  chain ??= makeNamesChain(env.NAMES_OPERATOR_KEY as Hex, broviderRpc(8453));
  return handleNames(request, { chain, store: kvStore(env.NAMES_KV) });
}
