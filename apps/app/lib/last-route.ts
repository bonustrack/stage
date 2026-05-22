/** Persist the last route pathname so cold opens restore the screen the user was on.
 *  SecureStore (encrypted on Android, Keychain on iOS) — same surface used by the rest of
 *  the app for small per-user persisted bits. */

import * as SecureStore from 'expo-secure-store';

const KEY = 'last-route-path';

export async function saveLastRoute(path: string): Promise<void> {
  /** Don't persist sub-pages that can'​t deep-link cleanly without their data
   *  (event/[id] needs the `data` query param to render). Stick to tab roots. */
  if (path.startsWith('/event/')) return;
  await SecureStore.setItemAsync(KEY, path).catch(() => { /* ignore */ });
}

export async function loadLastRoute(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(KEY); }
  catch { return null; }
}
