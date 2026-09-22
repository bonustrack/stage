import { DevSettings, Platform } from 'react-native';
import { reloadAsync } from 'expo-updates';
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
  if (DevSettings.reload) { DevSettings.reload(); return; }
  void reloadAsync().catch(() => undefined);
}
