import { DevSettings, Platform } from 'react-native';
import { type AccountRecord } from '../lib/accounts';

export const TYPE_LABEL: Record<AccountRecord['type'], string> = {
  generated: 'Generated',
  privateKey: 'Imported key',
  walletconnect: 'WalletConnect',
  smart: 'Smart wallet',
};

export function reloadApp(home = false): void {
  if (Platform.OS === 'web') {
    const location = (globalThis as { location?: { reload: () => void; replace: (url: string) => void; origin: string; pathname: string } }).location;
    if (home) location?.replace(location.origin + location.pathname);
    else location?.reload();
    return;
  }
  DevSettings.reload?.();
}
