
import { DevSettings } from 'react-native';
import { type AccountRecord } from '../lib/accounts';

export const TYPE_LABEL: Record<AccountRecord['type'], string> = {
  generated: 'Generated',
  privateKey: 'Imported key',
  walletconnect: 'WalletConnect',
  smart: 'Smart wallet',
};

export function reloadApp(): void {
  DevSettings.reload?.();
}
