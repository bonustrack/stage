/** On-device XMTP sqlite store plumbing: the AES db-encryption key + the writable
 *  store directory. Extracted from lib/xmtp.ts (phase-2 lint split); internal to
 *  the client module. */

import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';

const DB_ENCRYPTION_KEY = 'xmtp.dbEncryptionKey';

/** XMTP requires a 32-byte key it uses to AES-encrypt the on-device sqlite store. We mint
 *  one on first launch and persist it in expo-secure-store (secure enclave on iOS, Android
 *  keystore on Android). Without this the DB is unreadable across launches. */
export async function loadOrCreateDbKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(DB_ENCRYPTION_KEY).catch(() => null);
  if (existing) {
    const bin = atob(existing);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const fresh = new Uint8Array(32);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(fresh);
  } else {
    /** Fallback — Math.random is non-cryptographic but the alternative is failing to boot.
     *  In practice RN provides crypto.getRandomValues, so we never hit this. */
    for (let i = 0; i < fresh.length; i++) fresh[i] = Math.floor(Math.random() * 256);
  }
  let b64 = '';
  for (const byte of fresh) b64 += String.fromCharCode(byte);
  await SecureStore.setItemAsync(DB_ENCRYPTION_KEY, btoa(b64));
  return fresh;
}

/** Delete the persisted db-encryption key (full-wipe path). */
export async function deleteDbKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DB_ENCRYPTION_KEY).catch(() => undefined);
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
