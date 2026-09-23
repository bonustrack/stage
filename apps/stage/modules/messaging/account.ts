
import { useQuery } from '@tanstack/react-query';
import type { XmtpEnv } from '../../lib/xmtp.types';
import { switchToAccount } from '../../lib/xmtp.client';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { useAccountEpoch } from '../../lib/accountEpoch';

export const AccountManager = {
  switch: async (id: string, env?: XmtpEnv): Promise<void> => { await switchToAccount(id, env); },
} as const;

export function useActiveAccount(): number {
  return useAccountEpoch();
}

export function useActiveAccountRecord(): AccountRecord | null {
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['activeAccount', epoch],
    queryFn: () => getActiveAccount(),
    staleTime: Infinity,
  });
  return data ?? null;
}
