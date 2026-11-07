import { useQuery } from '@tanstack/react-query';
import { getActiveAccount } from '../accounts';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { accountQueryKeyAt, useAccountGeneration } from '../queryClient';
import { useKnownActiveAccountId } from '../accountSelection';

export function useActiveAccountRecord(): AccountRecord | null {
  const epoch = useAccountGeneration('client');
  const { data } = useQuery({
    queryKey: accountQueryKeyAt('client', epoch, 'activeAccount'),
    queryFn: () => getActiveAccount(),
    staleTime: Infinity,
  });
  return data ?? null;
}

export function useSelfAddress(): string | null {
  const known = useKnownActiveAccountId();
  const record = useActiveAccountRecord();
  return known ?? record?.address.toLowerCase() ?? null;
}
