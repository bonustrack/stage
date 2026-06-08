/** Account switching, behind the messaging facade. Re-exposes the atomic
 *  account-switch primitive (`switchToAccount`) and the account-epoch signal
 *  (`bumpAccountEpoch` / `useAccountEpoch` / `getAccountEpoch`) through one named
 *  surface. `switchToAccount` bundles `resetClientScopedState` +
 *  `setActiveAccountId` + `bumpAccountEpoch` atomically (see lib/xmtp.client). */

import type { Client } from '@xmtp/react-native-sdk';
import type { XmtpEnv } from '../../lib/xmtp';
import { switchToAccount, deleteAccount } from '../../lib/xmtp';
import {
  bumpAccountEpoch,
  getAccountEpoch,
  useAccountEpoch,
} from '../../lib/accountEpoch';

/** The account-switch surface. `switch` performs the in-place XMTP client swap +
 *  epoch bump (no hard app reload); `remove` deletes an account; `bumpEpoch`
 *  manually signals an account-state change (rare, lib-internal call sites). */
export const AccountManager = {
  switch: (id: string, env?: XmtpEnv): Promise<Client> => switchToAccount(id, env),
  remove: (id: string): Promise<void> => deleteAccount(id),
  bumpEpoch: (): void => bumpAccountEpoch(),
  getEpoch: (): number => getAccountEpoch(),
} as const;

/** Re-renders the caller whenever the active account changes. Use the returned
 *  value as a useEffect dependency to re-run per-account initialisation. Thin
 *  alias over `useAccountEpoch` so components observe the active account through
 *  the facade rather than reaching into `lib/accountEpoch`. */
export function useActiveAccount(): number {
  return useAccountEpoch();
}
