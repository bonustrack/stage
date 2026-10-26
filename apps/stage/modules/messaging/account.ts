import { useQuery } from '@tanstack/react-query';
import { switchToAccount } from '../../lib/xmtp.client';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { useAccountEpoch } from '../../lib/accountEpoch';


export const AccountManager = {
  switch: async (id: string): Promise<void> => { await switchToAccount(id); },
} as const;

export function useActiveAccountRecord(): AccountRecord | null {
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['activeAccount', epoch],
    queryFn: () => getActiveAccount(),
    staleTime: Infinity,
  });
  return data ?? null;
}
