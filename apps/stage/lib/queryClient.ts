import { QueryClient } from '@tanstack/react-query';
import { getAccountEpoch, useAccountEpoch } from './accountEpoch';
import { getAccountSelection, subscribeAccountChange, useAccountSelection, type AccountMoment } from './accountSelection';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false } },
});

export function getQueryClient(): QueryClient {
  return queryClient;
}

const ACCOUNT_QUERY = 'account';

function generationOf(moment: AccountMoment): number {
  return moment === 'client' ? getAccountEpoch() : getAccountSelection();
}

export function accountQueryKeyAt<const K extends readonly unknown[]>(moment: AccountMoment, generation: number, ...key: K) {
  return [ACCOUNT_QUERY, moment, generation, ...key] as const;
}

export function accountQueryKey<const K extends readonly unknown[]>(moment: AccountMoment, ...key: K) {
  return accountQueryKeyAt(moment, generationOf(moment), ...key);
}

export function useAccountGeneration(moment: AccountMoment): number {
  const epoch = useAccountEpoch();
  const selection = useAccountSelection();
  return moment === 'client' ? epoch : selection;
}

subscribeAccountChange((moment) => {
  const current = generationOf(moment);
  queryClient.removeQueries({
    predicate: ({ queryKey: [root, keyMoment, generation] }) => root === ACCOUNT_QUERY && keyMoment === moment && generation !== current,
  });
});
