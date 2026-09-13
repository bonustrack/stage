
import { useQuery } from '@tanstack/react-query';
import type { Client } from '@xmtp/react-native-sdk';
import type { XmtpEnv } from '../../lib/xmtp';
import { switchToAccount } from '../../lib/xmtp';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { bumpAccountEpoch, useAccountEpoch } from '../../lib/accountEpoch';

export const AccountManager = {
  switch: (id: string, env?: XmtpEnv): Promise<Client> => switchToAccount(id, env),
  bumpEpoch: (): void => { bumpAccountEpoch(); },
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
