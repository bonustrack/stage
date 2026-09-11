import { useEffect, useState } from 'react';
import { namehash } from 'viem';
import { normalize } from 'viem/ens';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import { L2_RESOLVER_ABI, makeProfileClients, resolverForNode } from '@stage-labs/client/identity/onchainProfile';
import { parseHandle, type ParsedHandle } from '@stage-labs/client/routing/handles';
import { broviderRpc } from '@stage-labs/client/wallet/client';

const ZERO = '0x0000000000000000000000000000000000000000';
const cache = new Map<string, Promise<string | null>>();

async function resolveBasenameAddress(name: string): Promise<string | null> {
  const client = makeProfileClients(broviderRpc).base;
  const node = namehash(normalize(name));
  const resolver = await resolverForNode(client, node);
  if (!resolver) return null;
  const address = await client.readContract({ address: resolver, abi: L2_RESOLVER_ABI, functionName: 'addr', args: [node] });
  return address === ZERO ? null : address.toLowerCase();
}

function resolveParsed(parsed: ParsedHandle): Promise<string | null> {
  switch (parsed.kind) {
    case 'address': return Promise.resolve(parsed.value);
    case 'stage':
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
