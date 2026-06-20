/** @file On-device XMTP sqlite store plumbing — the device-bound AES db-encryption key (per-account, with legacy-key migration) and the writable store directory; extracted from lib/xmtp.ts, internal to the client module. */

import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';

/** SECURITY: the XMTP store-encryption key is device-bound at rest (WHEN_UNLOCKED_THIS_DEVICE_ONLY); the default AFTER_FIRST_UNLOCK is iCloud-backup-eligible, letting a backup leak this AES key and decrypt the message store off-device. */
const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** LEGACY single global key (pre per-account). Kept for graceful migration: the first account on an upgraded install adopts this key so its existing store stays readable; everything afterwards is keyed PER ACCOUNT. */
const LEGACY_DB_ENCRYPTION_KEY = 'xmtp.dbEncryptionKey';

/** Per-account key id. SecureStore keys must match `[A-Za-z0-9._-]+`, so the account's dbDir name (already filesystem-safe) is the natural scope. */
function dbKeyId(accountId: string): string {
  return `xmtp.dbEncryptionKey.${accountId}`;
}

/** Decode Key. */
function decodeKey(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode Key. */
function encodeKey(key: Uint8Array): string {
  let s = '';
  for (const byte of key) s += String.fromCharCode(byte);
  return btoa(s);
}

/** Random Key. */
function randomKey(): Uint8Array {
  const fresh = new Uint8Array(32);
  /** This 32-byte key AES-encrypts the on-device XMTP SQLite store; a non-CSPRNG key would be derivable from disk, so we HARD-FAIL when crypto.getRandomValues is absent rather than mint a weak key. */
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure random unavailable: refusing to create a weak XMTP store-encryption key');
  }
  globalThis.crypto.getRandomValues(fresh);
  return fresh;
}

/** Load or create the per-account 32-byte AES key for the on-device XMTP sqlite store (scoped by accountId, persisted in expo-secure-store); migrates a legacy global key for the first account, else mints a fresh random key. */
export async function loadOrCreateDbKey(accountId: string): Promise<Uint8Array> {
  const id = dbKeyId(accountId);
  const existing = await SecureStore.getItemAsync(id, STORE_OPTS).catch(() => null);
  if (existing) return decodeKey(existing);

  const legacy = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  if (legacy) {
    /** Adopt the legacy global key for this (first/existing) account. Re-persist device-bound (STORE_OPTS) even though the legacy original may have been written without it, so the per-account copy is correctly device-bound. */
    await SecureStore.setItemAsync(id, legacy, STORE_OPTS).catch(() => undefined);
    return decodeKey(legacy);
  }

  const fresh = randomKey();
  await SecureStore.setItemAsync(id, encodeKey(fresh), STORE_OPTS);
  return fresh;
}

/** Delete the persisted db-encryption key for ONE account. */
export async function deleteDbKey(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(dbKeyId(accountId)).catch(() => undefined);
}

/** Delete the legacy global db key (full-reset path only). */
export async function deleteLegacyDbKey(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_DB_ENCRYPTION_KEY).catch(() => undefined);
}

/** Auto-recovery wipe for a corrupt/key-mismatched local store: deletes only THIS account's store dir + per-account key, also dropping the legacy global key when (and only when) this account's key byte-equals it so the retry mints a genuinely fresh key. */
export async function wipeXmtpStore(accountId: string, dbDirName: string): Promise<void> {
  /** Delete the whole on-disk store dir (db3 + -wal/-shm + read-only `.sqlcipher_salt`) so no stale db3 or salt under the old key survives — a surviving mismatch triggers `PRAGMA key or salt has incorrect value`. */
  deleteDbFiles(dbDirName);
  /** Decide BEFORE deleting the per-account key whether it matched the legacy key. */
  const accountKey = await SecureStore.getItemAsync(dbKeyId(accountId), STORE_OPTS).catch(() => null);
  const legacyKey = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  await deleteDbKey(accountId);
  /** Drop the legacy global key only when THIS account was keyed by it (matching key, or no per-account key yet so it would re-adopt the legacy one) — that's what makes the retry mint a fresh key. */
  if (legacyKey && (accountKey === legacyKey || accountKey === null)) {
    await deleteLegacyDbKey();
  }
}

/** Remove one account's on-disk sqlite store, leaving an empty consistent dir for a fresh Client.create; a partial wipe (db3 without salt or vice versa) is fatal, so wipe the whole tree in one recursive call (per-file sweep fallback) then recreate it empty. */
export function deleteDbFiles(dbDirName: string): void {
  const dir = dbDirObj(dbDirName);
  if (!dir.exists) {
    /** Nothing on disk — make sure the (absent) dir is recreated empty so the caller's ensureDbDir + create see a clean, consistent starting point. */
    try { dir.create({ intermediates: true }); } catch { /* created by ensureDbDir */ }
    return;
  }
  try {
    /** One recursive native delete removes db3 + -wal + -shm + the read-only `.sqlcipher_salt` sidecar atomically — no partial key/db/salt state. */
    dir.delete();
  } catch {
    /** Recursive delete failed (rare: busy handle) — sweep every file by hand so we at least don't leave a db3 without its salt or vice-versa. */
    try {
      for (const entry of dir.list()) {
        if (entry instanceof File) { try { entry.delete(); } catch { /* best-effort */ } }
      }
    } catch { /* list() can throw if the dir vanished mid-wipe — fine */ }
    try { dir.delete(); } catch { /* best-effort: files above already gone */ }
  }
  /** Recreate the dir empty so key ↔ db ↔ salt are all freshly consistent: an empty dir forces libxmtp down its "(false,false) → create new db+salt" path with our fresh key, instead of inheriting any stale db3 or salt. */
  try { dbDirObj(dbDirName).create({ intermediates: true }); } catch { /* ensureDbDir will */ }
}

/** XMTP needs a writable directory for its sqlite + key store. Document directory is app-private + persisted across restarts. */
function dbDirObj(name: string): Directory { return new Directory(Paths.document, name); }

/** Ensure the XMTP sqlite/key-store directory exists and is writable, returning its fs path. */
export function ensureDbDir(name: string): Promise<string> {
  const dir = dbDirObj(name);
  /** Create the dir (recursively) BEFORE create() so the native SQLCipher open has a real, writable, app-private target. A missing dir is the classic cause of `Permission denied (os error 13)` / `disk I/O error` on a clean install. */
  if (!dir.exists) dir.create({ intermediates: true });
  const path = toFsPath(dir);
  if (__DEV__) assertWritableDir(dir, path);
  return Promise.resolve(path);
}

/** Convert an expo-file-system directory URI into the absolute filesystem path libxmtp expects (not a `file://` URI or relative path): strip the scheme + leading slashes, re-anchor to one `/`, collapse double slashes, and drop the trailing slash; a malformed path causes the native open's os error 13. */
function toFsPath(dir: Directory): string {
  const decoded = (() => { try { return decodeURI(dir.uri); } catch { return dir.uri; } })();
  return '/' + decoded
    .replace(/^file:\/+/i, '')   /** drop scheme + every leading slash */
    .replace(/\/{2,}/g, '/')     /** collapse any `//` in the body */
    .replace(/\/+$/, '');        /** drop trailing slash(es) */
}

/** DEV-ONLY sanity: confirm the dbDirectory exists and is writable BEFORE handing it to Client.create, logging the PATH (never the key) so the os-error-13 cluster is diagnosable from logcat. Never throws — purely diagnostic. */
function assertWritableDir(dir: Directory, path: string): void {
  try {
    const probe = new File(dir, '.xmtp_write_probe');
    probe.write('1');
    const ok = probe.exists;
    try { probe.delete(); } catch { /* probe cleanup best-effort */ }
    console.log(`[xmtp] dbDirectory ready path=${path} exists=${dir.exists} writable=${ok}`);
  } catch (e) {
    console.warn(`[xmtp] dbDirectory NOT writable path=${path} exists=${dir.exists} err=${String(e)}`);
  }
}
