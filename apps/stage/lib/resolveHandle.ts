import { useEffect, useState } from 'react';
import { useQuery, type Query } from '@tanstack/react-query';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import { baseProfileClient, resolveBasenameAddress } from '@stage-labs/client/identity/onchainProfile';
import { stageLabelOf } from '@stage-labs/client/identity/stageNames';
import { fetchIssuedAddress } from '@stage-labs/client/identity/namesApi';
import { lookupFor, settleLookup, startLookup, type LookupPolicy, type PersonLookup } from '@stage-labs/client/identity/personLookup';
import { parseHandle, type ParsedHandle } from '@stage-labs/client/routing/handles';
import { linkProxyBase } from './linkProxy';
import { getQueryClient } from './queryClient';
import { recover } from './errorPolicy';

function basenameAddress(name: string): Promise<string | null> {
  return resolveBasenameAddress(baseProfileClient(), name);
}

async function resolveStageName(name: string): Promise<string | null> {
  const label = stageLabelOf(name);
  const issued = label ? await fetchIssuedAddress(linkProxyBase(), label).catch(recover('handle.issued', null)) : null;
  if (issued) return issued;
  return basenameAddress(name).catch(recover('handle.basename', null));
}

function resolveParsed(parsed: ParsedHandle): Promise<string | null> {
  switch (parsed.kind) {
    case 'address':
      return Promise.resolve(parsed.value);
    case 'stage':
      return resolveStageName(parsed.value);
    case 'basename':
      return basenameAddress(parsed.value);
    case 'ens':
      return resolveEnsName(parsed.value).then((a) => a?.toLowerCase() ?? null);
    default:
      return Promise.resolve(null);
  }
}

function handleQuery(parsed: ParsedHandle) {
  return {
    queryKey: ['handle', parsed.kind, parsed.value],
    queryFn: () => resolveParsed(parsed).catch(recover('handle.resolve', null)),
    staleTime: (q: Query<string | null>) => (q.state.data === null ? 0 : Infinity),
    gcTime: Infinity,
  };
}

export function resolveHandleToAddress(raw: string | null | undefined): Promise<string | null> {
  const parsed = parseHandle(raw);
  if (parsed.kind === 'address') return Promise.resolve(parsed.value);
  return getQueryClient().fetchQuery(handleQuery(parsed));
}

export interface ResolvedHandle {
  address: string | null;
  resolving: boolean;
  kind: ParsedHandle['kind'];
}

export function useResolvedHandle(raw: string | null | undefined): ResolvedHandle {
  const parsed = parseHandle(raw);
  const lookup = parsed.kind !== 'address' && parsed.kind !== 'invalid';
  const q = useQuery({ ...handleQuery(parsed), enabled: lookup });
  if (parsed.kind === 'address') return { address: parsed.value, resolving: false, kind: parsed.kind };
  const address = lookup ? (q.data ?? null) : null;
  return { address, resolving: lookup && address === null && q.isFetching, kind: parsed.kind };
}

const LOOKUP_DEBOUNCE_MS = 300;

export async function lookupPerson(input: string, policy: LookupPolicy): Promise<PersonLookup> {
  const start = startLookup(input, policy);
  return start.kind === 'resolving' ? settleLookup(start, await resolveHandleToAddress(start.name)) : start;
}

export function usePersonLookup(input: string, policy: LookupPolicy, enabled = true): PersonLookup {
  const [stored, setStored] = useState<PersonLookup>(() => startLookup(input, policy));
  useEffect(() => {
    const start = startLookup(input, policy);
    setStored(start);
    if (!enabled || start.kind !== 'resolving') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void resolveHandleToAddress(start.name).then((address) => {
        if (!cancelled) setStored(settleLookup(start, address));
      });
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, enabled, policy.mainnetEns]);
  return lookupFor(stored, input, policy);
}
