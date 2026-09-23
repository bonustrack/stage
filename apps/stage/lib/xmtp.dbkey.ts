import { base64ToBytes, bytesToBase64 } from '@stage-labs/client/text/base64';
import { deleteDbFiles } from './xmtp.dbkeyFs';
import { secureStorage } from '../platform/storage';
import type { DeviceBoundAccessOptions } from '../platform/types';

const STORE_OPTS: DeviceBoundAccessOptions = {
  thisDeviceOnly: true,
};

const LEGACY_DB_ENCRYPTION_KEY = 'xmtp.dbEncryptionKey';

function dbKeyId(accountId: string): string {
  return `xmtp.dbEncryptionKey.${accountId}`;
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
  const existing = await secureStorage.get(id, STORE_OPTS);
  if (existing) return base64ToBytes(existing);

  const legacy = await secureStorage.get(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS);
  if (legacy) {
    await secureStorage.set(id, legacy, STORE_OPTS).catch(() => undefined);
    return base64ToBytes(legacy);
  }

  const fresh = randomKey();
  await secureStorage.set(id, bytesToBase64(fresh), STORE_OPTS);
  return fresh;
}

export async function deleteDbKey(accountId: string): Promise<void> {
  await secureStorage.delete(dbKeyId(accountId)).catch(() => undefined);
}

async function deleteLegacyDbKey(): Promise<void> {
  await secureStorage.delete(LEGACY_DB_ENCRYPTION_KEY).catch(() => undefined);
}

export async function wipeXmtpStore(accountId: string, dbDirName: string): Promise<void> {
  await deleteDbFiles(dbDirName);
  const accountKey = await secureStorage.get(dbKeyId(accountId), STORE_OPTS).catch(() => null);
  const legacyKey = await secureStorage.get(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  await deleteDbKey(accountId);
  if (legacyKey && (accountKey === legacyKey || accountKey === null)) {
    await deleteLegacyDbKey();
  }
}

export { deleteDbFiles, ensureDbDir } from './xmtp.dbkeyFs';
