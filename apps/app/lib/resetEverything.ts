/** @file Dev "Reset everything" full nuke: erases every slice of device-local state the app owns (AsyncStorage, remaining SecureStore keys, app-owned FileSystem trees) and reloads for a byte-for-byte clean install, leaving OS-managed Paths.cache scratch untouched. */

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

/** Mirror of lib/theme.ts -> @stage-labs/kit THEME_STORAGE_KEY. */
const THEME_KEY = 'app.theme';
/** Mirror of lib/xmtp.client.ts. */
const LAST_READ_PREFIX = 'unread.lastRead.';

/** Delete the per-conversation `unread.lastRead.<convId>` SecureStore markers by collecting every convId across all accounts' cached rows (hydrating each first); best-effort so the device truly holds zero state. */
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
  } catch { /* best-effort enumeration */ }
  await Promise.all(
    [...convIds].map(id =>
      SecureStore.deleteItemAsync(LAST_READ_PREFIX + id).catch(() => undefined),
    ),
  );
}

/** Recursively delete an app-owned directory under the document sandbox. */
function deleteDocDir(name: string): void {
  try {
    const dir = new Directory(Paths.document, name);
    if (dir.exists) dir.delete();
  } catch { /* best-effort - a missing/locked dir shouldn't abort the nuke */ }
}

/** Full local-state nuke + reload. After this the app is a clean install: onboarding's Welcome shows, no accounts, no settings, no cached data. */
export async function resetEverything(): Promise<void> {
  /** 1. Collect + drop the dynamic lastRead markers BEFORE we wipe the caches that tell us which convIds exist. */
  await clearLastReadMarkers();

  /** 2. Accounts + wallet keys + recovery phrase + every XMTP store + db keys (resetXmtpClient -> clearAllAccounts + per-account/legacy db keys + the on-disk xmtp dirs; deletes xmtp.env too). */
  await resetXmtpClient();
  await clearMnemonic();
  await setWalletBackedUp(false);

  /** 3. Remaining fixed SecureStore keys resetForOnboarding doesn't own. */
  await SecureStore.deleteItemAsync(THEME_KEY).catch(() => undefined);

  /** 4. The ENTIRE AsyncStorage - every setting / flag / pref / cache. */
  await AsyncStorage.clear().catch(() => undefined);

  /** 5. App-owned FileSystem trees (PersistentStore caches + drafts + Railgun engine state). Paths.cache scratch is OS-managed and left alone. */
  deleteDocDir('metro');
  deleteDocDir('railgun-artifacts');
  deleteDocDir('railgun-db');

  /** 6. Flip the account gate now, then reload so every in-memory store mirror re-reads from the now-empty disk and the session looks freshly installed. */
  bumpAccountEpoch();
  DevSettings.reload?.();
}
