import { useQuery } from '@tanstack/react-query';
import { getActiveAccount } from '../accounts';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { useAccountEpoch } from '../accountEpoch';

export function useActiveAccountRecord(): AccountRecord | null {
  const epoch = useAccountEpoch();
  const { data } = useQuery({ queryKey: ['activeAccount', epoch], queryFn: () => getActiveAccount(), staleTime: Infinity });
  return data ?? null;
}

export function useSelfAddress(): string {
  return (useActiveAccountRecord()?.address ?? '').toLowerCase();
}
