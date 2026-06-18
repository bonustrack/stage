/** AccountsManager helpers + constants — extracted for lint line-budget. */

import { DevSettings } from 'react-native';
import { type AccountRecord } from '../lib/accounts';

export const TYPE_LABEL: Record<AccountRecord['type'], string> = {
  generated: 'Generated',
  privateKey: 'Imported key',
  walletconnect: 'WalletConnect',
  smart: 'Smart wallet',
};

/** Reloads the running app (dev-client reload; no-op in published builds). */
export function reloadApp(): void {
  /** Dev-client reload. In a published build this is a no-op; swap to
   *  expo-updates' reloadAsync if/when we ship one. */
  DevSettings.reload?.();
}
