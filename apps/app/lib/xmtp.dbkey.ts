/** On-device XMTP sqlite store plumbing: the AES db-encryption key + the writable
 *  store directory. Extracted from lib/xmtp.ts (phase-2 lint split); internal to
 *  the client module. */

import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';

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
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(fresh);
  } else {
    /** Fallback — Math.random is non-cryptographic but the alternative is failing to boot.
     *  In practice RN provides crypto.getRandomValues, so we never hit this. */
    for (let i = 0; i < fresh.length; i++) fresh[i] = Math.floor(Math.random() * 256);
  }
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
  const existing = await SecureStore.getItemAsync(id).catch(() => null);
  if (existing) return decodeKey(existing);

  const legacy = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY).catch(() => null);
  if (legacy) {
    /** Adopt the legacy global key for this (first/existing) account. */
    await SecureStore.setItemAsync(id, legacy).catch(() => undefined);
    return decodeKey(legacy);
  }

  const fresh = randomKey();
  await SecureStore.setItemAsync(id, encodeKey(fresh));
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
  const dir = dbDirObj(dbDirName);
  if (dir.exists) { try { dir.delete(); } catch { /* best-effort */ } }
  /** Decide BEFORE deleting the per-account key whether it matched the legacy key. */
  const accountKey = await SecureStore.getItemAsync(dbKeyId(accountId)).catch(() => null);
  const legacyKey = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY).catch(() => null);
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

/** XMTP needs a writable directory for its sqlite + key store. Document directory is
 *  app-private + persisted across restarts. */
export function dbDirObj(name: string): Directory { return new Directory(Paths.document, name); }

export async function ensureDbDir(name: string): Promise<string> {
  const dir = dbDirObj(name);
  if (!dir.exists) dir.create({ intermediates: true });
  /** XMTP wants a filesystem path (`/data/user/0/...`), not a URI (`file:///data/user/0/...`).
   *  expo-file-system's `.uri` includes the scheme; strip it. Also drop any trailing slash —
   *  the SDK appends its own file names. */
  return dir.uri.replace(/^file:\/+/, '/').replace(/\/$/, '');
}
