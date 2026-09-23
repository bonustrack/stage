import { useEffect, useState } from 'react';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import { baseProfileClient, resolveBasenameAddress } from '@stage-labs/client/identity/onchainProfile';
import { fetchIssuedAddress } from '@stage-labs/client/identity/stageNames';
import { parseHandle, stageLabelOf, type ParsedHandle } from '@stage-labs/client/routing/handles';
import { linkProxyBase } from './historyServer';

const cache = new Map<string, Promise<string | null>>();

function basenameAddress(name: string): Promise<string | null> {
  return resolveBasenameAddress(baseProfileClient(), name);
}

async function resolveStageName(name: string): Promise<string | null> {
  const label = stageLabelOf(name);
  const issued = label ? await fetchIssuedAddress(linkProxyBase(), label).catch(() => null) : null;
  if (issued) return issued;
  return basenameAddress(name).catch(() => null);
}

function resolveParsed(parsed: ParsedHandle): Promise<string | null> {
  switch (parsed.kind) {
    case 'address': return Promise.resolve(parsed.value);
    case 'stage': return resolveStageName(parsed.value);
    case 'basename': return basenameAddress(parsed.value);
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
