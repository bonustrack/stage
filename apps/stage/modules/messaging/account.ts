import { useQuery } from '@tanstack/react-query';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { useAccountEpoch } from '../../lib/accountEpoch';

export function useActiveAccountRecord(): AccountRecord | null {
  const epoch = useAccountEpoch();
  const { data } = useQuery({ queryKey: ['activeAccount', epoch], queryFn: () => getActiveAccount(), staleTime: Infinity });
  return data ?? null;
}
