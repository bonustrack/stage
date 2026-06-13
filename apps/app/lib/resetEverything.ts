/** Dev "Reset everything" - the FULL nuke.
 *
 *  resetForOnboarding() (lib/wallet) is the targeted reset: it wipes accounts +
 *  wallet keys + the recovery phrase + every XMTP store and bumps the account
 *  epoch so the gate re-onboards. This module is the bigger hammer: on top of
 *  ALL of that it erases every other slice of device-local state the app owns,
 *  so the next launch is byte-for-byte a clean install:
 *
 *    - the entire AsyncStorage (every setting, flag, pref, pins/archived/read
 *      markers, onboarding flags, color/radius overrides, scroll/last-route,
 *      push prefs, debug-console flag, channels JSON if any leaked there),
 *    - the remaining fixed SecureStore keys the app writes that resetForOnboarding
 *      does NOT touch (theme `app.theme`) plus the dynamic `unread.lastRead.<conv>`
 *      markers (enumerated from the cached rows before the wipe),
 *    - the app-owned FileSystem trees: `Paths.document/metro` (PersistentStore
 *      channel caches + composer drafts) and the Railgun engine dirs
 *      (railgun-artifacts / railgun-db).
 *
 *  WHAT IT DOES NOT TOUCH: OS-managed scratch in Paths.cache (image viewer /
 *  swarm temp copies - the OS evicts these and they carry no identity), and
 *  anything outside the app sandbox.
 *
 *  Unlike resetForOnboarding, this RELOADS the app at the end. The boot account
 *  gate flips on its own from the epoch bump, but the value/set stores hold
 *  their cleared-on-disk data in IN-MEMORY mirrors (theme, pins, archived,
 *  overrides, debug-console, ...) that only re-read on a fresh process - so a
 *  reload is required for the running session to actually look freshly
 *  installed. DevSettings.reload is the dev-client reload used everywhere else. */

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

/** Mirror of lib/theme.ts -> @metro-labs/kit THEME_STORAGE_KEY. */
const THEME_KEY = 'app.theme';
/** Mirror of lib/xmtp.client.ts. */
const LAST_READ_PREFIX = 'unread.lastRead.';

/** Delete the per-conversation `unread.lastRead.<convId>` SecureStore markers.
 *  They're keyed by convId so there's no clear-all; we collect every convId
 *  across all accounts' cached rows (hydrating each account's file first) and
 *  delete those keys. Best-effort: an orphaned marker is harmless after a fresh
 *  identity is minted, but we clear them so the device truly holds zero state. */
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

/** Full local-state nuke + reload. After this the app is a clean install:
 *  onboarding's Welcome shows, no accounts, no settings, no cached data. */
export async function resetEverything(): Promise<void> {
  /** 1. Collect + drop the dynamic lastRead markers BEFORE we wipe the caches
   *     that tell us which convIds exist. */
  await clearLastReadMarkers();

  /** 2. Accounts + wallet keys + recovery phrase + every XMTP store + db keys
   *     (resetXmtpClient -> clearAllAccounts + per-account/legacy db keys + the
   *     on-disk xmtp dirs; deletes xmtp.env too). */
  await resetXmtpClient();
  await clearMnemonic();
  await setWalletBackedUp(false);

  /** 3. Remaining fixed SecureStore keys resetForOnboarding doesn't own. */
  await SecureStore.deleteItemAsync(THEME_KEY).catch(() => undefined);

  /** 4. The ENTIRE AsyncStorage - every setting / flag / pref / cache. */
  await AsyncStorage.clear().catch(() => undefined);

  /** 5. App-owned FileSystem trees (PersistentStore caches + drafts + Railgun
   *     engine state). Paths.cache scratch is OS-managed and left alone. */
  deleteDocDir('metro');
  deleteDocDir('railgun-artifacts');
  deleteDocDir('railgun-db');

  /** 6. Flip the account gate now, then reload so every in-memory store mirror
   *     re-reads from the now-empty disk and the session looks freshly
   *     installed. */
  bumpAccountEpoch();
  DevSettings.reload?.();
}
