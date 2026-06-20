/** @file Account-switch surface behind the messaging facade, re-exposing the atomic `switchToAccount` primitive and the account-epoch signal through one `AccountManager` named export. */

import type { Client } from '@xmtp/react-native-sdk';
import type { XmtpEnv } from '../../lib/xmtp';
import { switchToAccount, deleteAccount } from '../../lib/xmtp';
import {
  bumpAccountEpoch,
  getAccountEpoch,
  useAccountEpoch,
} from '../../lib/accountEpoch';

/** The account-switch surface. `switch` performs the in-place XMTP client swap + epoch bump (no hard app reload); `remove` deletes an account; `bumpEpoch` manually signals an account-state change (rare, lib-internal call sites). */
export const AccountManager = {
  switch: (id: string, env?: XmtpEnv): Promise<Client> => switchToAccount(id, env),
  remove: (id: string): Promise<void> => deleteAccount(id),
  bumpEpoch: (): void => { bumpAccountEpoch(); },
  getEpoch: (): number => getAccountEpoch(),
} as const;

/** Re-renders the caller on active-account change; use the returned value as a useEffect dependency for per-account init. A thin alias over `useAccountEpoch` so components observe the account through the facade, not `lib/accountEpoch`. */
export function useActiveAccount(): number {
  return useAccountEpoch();
}
