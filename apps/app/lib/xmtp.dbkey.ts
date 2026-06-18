/** On-device XMTP sqlite store plumbing: the AES db-encryption key + the writable
 *  store directory. Extracted from lib/xmtp.ts (phase-2 lint split); internal to
 *  the client module. */

import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';

/** SECURITY: the XMTP store-encryption key is device-bound at rest
 *  (WHEN_UNLOCKED_THIS_DEVICE_ONLY), mirroring the keyring's STORE_OPTS. Without
 *  this, expo-secure-store defaults to AFTER_FIRST_UNLOCK — which on iOS is
 *  eligible for iCloud Keychain sync / encrypted device backups, so an attacker
 *  with a backup could recover this AES key and decrypt the entire on-device
 *  message store off-device. Device-binding keeps the key on this device only. */
const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** LEGACY single global key (pre per-account). Kept for graceful migration: the
 *  first account on an upgraded install adopts this key so its existing store
 *  stays readable; everything afterwards is keyed PER ACCOUNT. */
const LEGACY_DB_ENCRYPTION_KEY = 'xmtp.dbEncryptionKey';

/** Per-account key id. SecureStore keys must match `[A-Za-z0-9._-]+`, so the
 *  account's dbDir name (already filesystem-safe) is the natural scope. */
function dbKeyId(accountId: string): string {
  return `xmtp.dbEncryptionKey.${accountId}`;
}

function decodeKey(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeKey(key: Uint8Array): string {
  let s = '';
  for (const byte of key) s += String.fromCharCode(byte);
  return btoa(s);
}

function randomKey(): Uint8Array {
  const fresh = new Uint8Array(32);
  /** This 32-byte key AES-encrypts the on-device XMTP SQLite store. A
   *  non-CSPRNG (Math.random) key is predictable, so an attacker with disk
   *  access could derive it and decrypt every message. If crypto.getRandomValues
   *  is somehow absent we HARD-FAIL rather than mint a weak key (mirrors
   *  x402.payHeader.ts's randomNonce, which throws for the same reason). RN
   *  installs crypto.getRandomValues app-wide, so this never fires in a healthy
   *  runtime. */
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure random unavailable: refusing to create a weak XMTP store-encryption key');
  }
  globalThis.crypto.getRandomValues(fresh);
  return fresh;
}

/** XMTP requires a 32-byte key it uses to AES-encrypt the on-device sqlite store.
 *  The key is now PER ACCOUNT (scoped by `accountId`), so wiping/recreating one
 *  account's store can NEVER affect another. Persisted in expo-secure-store
 *  (secure enclave on iOS, Android keystore on Android).
 *
 *  Migration: if this account has no per-account key yet but a legacy GLOBAL key
 *  exists, adopt the legacy key for this account (so a pre-existing, working
 *  store stays readable) and persist it under the per-account id. Brand-new
 *  accounts mint a fresh random key. */
export async function loadOrCreateDbKey(accountId: string): Promise<Uint8Array> {
  const id = dbKeyId(accountId);
  const existing = await SecureStore.getItemAsync(id, STORE_OPTS).catch(() => null);
  if (existing) return decodeKey(existing);

  const legacy = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  if (legacy) {
    /** Adopt the legacy global key for this (first/existing) account. Re-persist
     *  device-bound (STORE_OPTS) even though the legacy original may have been
     *  written without it, so the per-account copy is correctly device-bound. */
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

/** Auto-recovery wipe for a corrupt/key-mismatched LOCAL XMTP store. Deletes ONLY
 *  this account's on-disk sqlite store dir + its per-account db key, so the next
 *  Client.create mints a fresh key + store for THIS account alone. Never touches
 *  the account's private key / EOA registry, and never any OTHER account's key.
 *
 *  LEGACY-KEY CASE: a legacy-migrated account's per-account key is a COPY of the
 *  old global key (adopted in loadOrCreateDbKey). If that key is the corrupt one,
 *  deleting only the per-account copy is not enough: the retry's loadOrCreateDbKey
 *  finds no per-account key and RE-ADOPTS the still-present legacy global key — the
 *  same bad key — so create fails identically. To actually self-heal we must also
 *  drop the legacy global key when (and only when) THIS account was using it, so
 *  the retry mints a genuinely fresh key.
 *
 *  Safety: we delete the legacy key ONLY if this account's persisted per-account
 *  key byte-for-byte equals the legacy key. Any OTHER account that already loaded
 *  has its own persisted per-account copy (loadOrCreateDbKey persists on adopt),
 *  so it is unaffected. We never delete the legacy key on behalf of an account
 *  that wasn't actually keyed by it. */
export async function wipeXmtpStore(accountId: string, dbDirName: string): Promise<void> {
  /** Delete the on-disk store (db3 + -wal/-shm + the read-only `.sqlcipher_salt`
   *  sidecar) robustly — wiping the WHOLE dir — so neither a stale db3 NOR a
   *  stale salt encrypted under the OLD key survives at the path the fresh key
   *  will reopen. A surviving salt-without-db3 (or db3-without-salt) is exactly
   *  what triggers the persistent `PRAGMA key or salt has incorrect value`. */
  deleteDbFiles(dbDirName);
  /** Decide BEFORE deleting the per-account key whether it matched the legacy key. */
  const accountKey = await SecureStore.getItemAsync(dbKeyId(accountId), STORE_OPTS).catch(() => null);
  const legacyKey = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  await deleteDbKey(accountId);
  /** Only blow away the legacy global key if THIS account was actually keyed by it
   *  (i.e. it's the legacy-migrated account whose corrupt store we're wiping), or
   *  if this account had no per-account key yet but a legacy key exists (it would
   *  have adopted that same key on retry). Either way the legacy key is the one
   *  that would be re-adopted, so dropping it is what makes the retry fresh. */
  if (legacyKey && (accountKey === legacyKey || accountKey === null)) {
    await deleteLegacyDbKey();
  }
}

/** Remove the on-disk sqlite store for one account, leaving an EMPTY, consistent
 *  dir so the next Client.create starts fresh (key, db3 header, salt all mutually
 *  consistent). libxmtp/SQLCipher writes `<name>.db3` + `-wal`/`-shm` + the
 *  read-only `<name>.db3.sqlcipher_salt` sidecar; a db3 without its salt (or vice
 *  versa) makes every open fail with `PRAGMA key or salt has incorrect value`, so
 *  a partial wipe is fatal. We wipe the WHOLE dir tree in ONE recursive native
 *  call (handles the read-only salt + busy WAL handle far better than a JS loop),
 *  falling back to a per-file sweep only if that throws, then ALWAYS recreate it
 *  empty so the dir is guaranteed-clean for the fresh create. */
export function deleteDbFiles(dbDirName: string): void {
  const dir = dbDirObj(dbDirName);
  if (!dir.exists) {
    /** Nothing on disk — make sure the (absent) dir is recreated empty so the
     *  caller's ensureDbDir + create see a clean, consistent starting point. */
    try { dir.create({ intermediates: true }); } catch { /* created by ensureDbDir */ }
    return;
  }
  try {
    /** One recursive native delete removes db3 + -wal + -shm + the read-only
     *  `.sqlcipher_salt` sidecar atomically — no partial key/db/salt state. */
    dir.delete();
  } catch {
    /** Recursive delete failed (rare: busy handle) — sweep every file by hand so
     *  we at least don't leave a db3 without its salt or vice-versa. */
    try {
      for (const entry of dir.list()) {
        if (entry instanceof File) { try { entry.delete(); } catch { /* best-effort */ } }
      }
    } catch { /* list() can throw if the dir vanished mid-wipe — fine */ }
    try { dir.delete(); } catch { /* best-effort: files above already gone */ }
  }
  /** Recreate the dir empty so key ↔ db ↔ salt are all freshly consistent: an
   *  empty dir forces libxmtp down its "(false,false) → create new db+salt" path
   *  with our fresh key, instead of inheriting any stale db3 or salt. */
  try { dbDirObj(dbDirName).create({ intermediates: true }); } catch { /* ensureDbDir will */ }
}

/** XMTP needs a writable directory for its sqlite + key store. Document directory is
 *  app-private + persisted across restarts. */
function dbDirObj(name: string): Directory { return new Directory(Paths.document, name); }

/** Ensure the XMTP sqlite/key-store directory exists and is writable, returning its fs path. */
export async function ensureDbDir(name: string): Promise<string> {
  const dir = dbDirObj(name);
  /** Create the dir (recursively) BEFORE create() so the native SQLCipher open
   *  has a real, writable, app-private target. A missing dir is the classic cause
   *  of `Permission denied (os error 13)` / `disk I/O error` on a clean install. */
  if (!dir.exists) dir.create({ intermediates: true });
  const path = toFsPath(dir);
  if (__DEV__) assertWritableDir(dir, path);
  return path;
}

/** Convert an expo-file-system directory URI into the absolute filesystem path
 *  libxmtp expects (`/data/user/0/...`), NOT a `file://` URI and NOT a relative
 *  path. `Paths.document.uri` is always an absolute `file://` URI on iOS/Android,
 *  so we: (1) strip the `file:` scheme + ALL leading slashes and re-anchor to a
 *  single leading `/` (handles both `file:///abs` and the rare `file:/abs`),
 *  (2) collapse any accidental double slashes in the body, (3) drop the trailing
 *  slash since the SDK appends `<inboxId>.db3` itself. A malformed/relative path
 *  here is exactly what makes the native open fail with os error 13. */
function toFsPath(dir: Directory): string {
  const decoded = (() => { try { return decodeURI(dir.uri); } catch { return dir.uri; } })();
  return '/' + decoded
    .replace(/^file:\/+/i, '')   // drop scheme + every leading slash
    .replace(/\/{2,}/g, '/')     // collapse any `//` in the body
    .replace(/\/+$/, '');        // drop trailing slash(es)
}

/** DEV-ONLY sanity: confirm the dbDirectory exists and is writable BEFORE handing
 *  it to Client.create, logging the PATH (never the key) so the os-error-13
 *  cluster is diagnosable from logcat. Never throws — purely diagnostic. */
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
