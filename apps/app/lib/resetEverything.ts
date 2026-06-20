
import { DevSettings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';

import { resetXmtpClient } from './xmtp.client';
import { clearMnemonic } from './zerodev/keyring';
import { setWalletBackedUp } from './walletBackup';
import { bumpAccountEpoch } from './accountEpoch';
import { loadAccounts } from './accounts';
import { hydrateCachedRows, setActiveAccountForCache, getCachedRows } from './channelsCache';

const THEME_KEY = 'app.theme';
const LAST_READ_PREFIX = 'unread.lastRead.';

async function clearLastReadMarkers(): Promise<void> {
  const convIds = new Set<string>();
  try {
    const accounts = await loadAccounts();
    for (const acct of accounts) {
      setActiveAccountForCache(acct.id);
      await hydrateCachedRows();
      for (const row of getCachedRows() ?? []) {
        if (row?.convId) convIds.add(row.convId);
      }
    }
  } catch { }
  await Promise.all(
    [...convIds].map(id =>
      SecureStore.deleteItemAsync(LAST_READ_PREFIX + id).catch(() => undefined),
    ),
  );
}

function deleteDocDir(name: string): void {
  try {
    const dir = new Directory(Paths.document, name);
    if (dir.exists) dir.delete();
  } catch { }
}

export async function resetEverything(): Promise<void> {
  await clearLastReadMarkers();

  await resetXmtpClient();
  await clearMnemonic();
  await setWalletBackedUp(false);

  await SecureStore.deleteItemAsync(THEME_KEY).catch(() => undefined);

  await AsyncStorage.clear().catch(() => undefined);

  deleteDocDir('metro');
  deleteDocDir('railgun-artifacts');
  deleteDocDir('railgun-db');

  bumpAccountEpoch();
  DevSettings.reload?.();
}
