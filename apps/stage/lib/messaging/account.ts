import { useQuery } from '@tanstack/react-query';
import { getActiveAccount } from '../accounts';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { accountQueryKeyAt, useAccountGeneration } from '../queryClient';
import { selfAddressOf, useKnownActiveAccountId } from '../accountSelection';

interface ActiveAccount {
  record: AccountRecord | null;
  loaded: boolean;
}

export function useActiveAccount(): ActiveAccount {
  const epoch = useAccountGeneration('client');
  const { data, isPending } = useQuery({
    queryKey: accountQueryKeyAt('client', epoch, 'activeAccount'),
    queryFn: () => getActiveAccount(),
    staleTime: Infinity,
  });
  return { record: data ?? null, loaded: !isPending };
}

export function useActiveAccountRecord(): AccountRecord | null {
  return useActiveAccount().record;
}

export function useSelfAddress(): string | null {
  const known = useKnownActiveAccountId();
  const record = useActiveAccountRecord();
  return selfAddressOf(known ?? record?.address);
}
