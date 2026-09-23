import { useQuery, type Query } from '@tanstack/react-query';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import { baseProfileClient, resolveBasenameAddress } from '@stage-labs/client/identity/onchainProfile';
import { fetchIssuedAddress } from '@stage-labs/client/identity/stageNames';
import { parseHandle, stageLabelOf, type ParsedHandle } from '@stage-labs/client/routing/handles';
import { linkProxyBase } from './historyServer';
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
    case 'address': return Promise.resolve(parsed.value);
    case 'stage': return resolveStageName(parsed.value);
    case 'basename': return stageLabelOf(parsed.value) === null ? basenameAddress(parsed.value) : resolveStageName(parsed.value);
    case 'ens': return resolveEnsName(parsed.value).then((a) => a?.toLowerCase() ?? null);
    default: return Promise.resolve(null);
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

export interface ResolvedHandle { address: string | null; resolving: boolean; kind: ParsedHandle['kind'] }

export function useResolvedHandle(raw: string | null | undefined): ResolvedHandle {
  const parsed = parseHandle(raw);
  const lookup = parsed.kind !== 'address' && parsed.kind !== 'invalid';
  const q = useQuery({ ...handleQuery(parsed), enabled: lookup });
  if (parsed.kind === 'address') return { address: parsed.value, resolving: false, kind: parsed.kind };
  const address = lookup ? q.data ?? null : null;
  return { address, resolving: lookup && address === null && q.isFetching, kind: parsed.kind };
}
