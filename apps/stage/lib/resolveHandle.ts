import { useEffect, useState } from 'react';
import { namehash } from 'viem';
import { normalize } from 'viem/ens';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import { L2_RESOLVER_ABI, makeProfileClients, nodeOwner, resolverForNode } from '@stage-labs/client/identity/onchainProfile';
import { parseHandle, stageLabelOf, type ParsedHandle } from '@stage-labs/client/routing/handles';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { linkProxyBase } from './historyServer';

const ZERO = '0x0000000000000000000000000000000000000000';
const cache = new Map<string, Promise<string | null>>();

async function resolveBasenameAddress(name: string): Promise<string | null> {
  const client = makeProfileClients(broviderRpc).base;
  const node = namehash(normalize(name));
  const resolver = await resolverForNode(client, node);
  if (!resolver) return null;
  const address = await client.readContract({ address: resolver, abi: L2_RESOLVER_ABI, functionName: 'addr', args: [node] });
  if (address !== ZERO) return address.toLowerCase();
  return (await nodeOwner(client, node))?.toLowerCase() ?? null;
}

async function issuedAddressFor(label: string): Promise<string | null> {
  const res = await fetch(`${linkProxyBase()}/names/resolve?label=${encodeURIComponent(label)}`, { headers: { 'x-stage-client': '1' } });
  if (!res.ok) return null;
  const body = (await res.json()) as { address?: string | null };
  return body.address ?? null;
}

async function resolveStageName(name: string): Promise<string | null> {
  const label = stageLabelOf(name);
  const issued = label ? await issuedAddressFor(label).catch(() => null) : null;
  if (issued) return issued;
  return resolveBasenameAddress(name).catch(() => null);
}

function resolveParsed(parsed: ParsedHandle): Promise<string | null> {
  switch (parsed.kind) {
    case 'address': return Promise.resolve(parsed.value);
    case 'stage': return resolveStageName(parsed.value);
    case 'basename': return resolveBasenameAddress(parsed.value);
    case 'ens': return resolveEnsName(parsed.value).then((a) => a?.toLowerCase() ?? null);
    default: return Promise.resolve(null);
  }
}

export function resolveHandleToAddress(raw: string | null | undefined): Promise<string | null> {
  const parsed = parseHandle(raw);
  if (parsed.kind === 'address') return Promise.resolve(parsed.value);
  const key = `${parsed.kind}:${parsed.value}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = resolveParsed(parsed).catch(() => null);
    cache.set(key, pending);
    void pending.then((v) => { if (v === null) cache.delete(key); });
  }
  return pending;
}

export interface ResolvedHandle { address: string | null; resolving: boolean; kind: ParsedHandle['kind'] }

export function useResolvedHandle(raw: string | null | undefined): ResolvedHandle {
  const parsed = parseHandle(raw);
  const immediate = parsed.kind === 'address' ? parsed.value : null;
  const [state, setState] = useState<ResolvedHandle>({ address: immediate, resolving: immediate === null && parsed.kind !== 'invalid', kind: parsed.kind });
  useEffect(() => {
    if (immediate !== null || parsed.kind === 'invalid') {
      setState({ address: immediate, resolving: false, kind: parsed.kind });
      return;
    }
    let cancelled = false;
    setState({ address: null, resolving: true, kind: parsed.kind });
    void resolveHandleToAddress(raw).then((address) => {
      if (!cancelled) setState({ address, resolving: false, kind: parsed.kind });
    });
    return () => { cancelled = true; };
  }, [parsed.kind, parsed.value]);
  return state;
}
