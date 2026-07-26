
import { deleteDbFiles } from './xmtp.dbkeyFs';
import { secureStorage } from '../platform/storage';
import type { SecureAccessOptions } from '../platform/types';

const STORE_OPTS: SecureAccessOptions = {
  thisDeviceOnly: true,
};

const LEGACY_DB_ENCRYPTION_KEY = 'xmtp.dbEncryptionKey';

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
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure random unavailable: refusing to create a weak XMTP store-encryption key');
  }
  globalThis.crypto.getRandomValues(fresh);
  return fresh;
}

export async function loadOrCreateDbKey(accountId: string): Promise<Uint8Array> {
  const id = dbKeyId(accountId);
  const existing = await secureStorage.get(id, STORE_OPTS).catch(() => null);
  if (existing) return decodeKey(existing);

  const legacy = await secureStorage.get(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  if (legacy) {
    await secureStorage.set(id, legacy, STORE_OPTS).catch(() => undefined);
    return decodeKey(legacy);
  }

  const fresh = randomKey();
  await secureStorage.set(id, encodeKey(fresh), STORE_OPTS);
  return fresh;
}

export async function deleteDbKey(accountId: string): Promise<void> {
  await secureStorage.delete(dbKeyId(accountId)).catch(() => undefined);
}

export async function deleteLegacyDbKey(): Promise<void> {
  await secureStorage.delete(LEGACY_DB_ENCRYPTION_KEY).catch(() => undefined);
}

export async function wipeXmtpStore(accountId: string, dbDirName: string): Promise<void> {
  deleteDbFiles(dbDirName);
  const accountKey = await secureStorage.get(dbKeyId(accountId), STORE_OPTS).catch(() => null);
  const legacyKey = await secureStorage.get(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  await deleteDbKey(accountId);
  if (legacyKey && (accountKey === legacyKey || accountKey === null)) {
    await deleteLegacyDbKey();
  }
}

export { deleteDbFiles, ensureDbDir } from './xmtp.dbkeyFs';
