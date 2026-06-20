
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';

const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
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
  const existing = await SecureStore.getItemAsync(id, STORE_OPTS).catch(() => null);
  if (existing) return decodeKey(existing);

  const legacy = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  if (legacy) {
    await SecureStore.setItemAsync(id, legacy, STORE_OPTS).catch(() => undefined);
    return decodeKey(legacy);
  }

  const fresh = randomKey();
  await SecureStore.setItemAsync(id, encodeKey(fresh), STORE_OPTS);
  return fresh;
}

export async function deleteDbKey(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(dbKeyId(accountId)).catch(() => undefined);
}

export async function deleteLegacyDbKey(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_DB_ENCRYPTION_KEY).catch(() => undefined);
}

export async function wipeXmtpStore(accountId: string, dbDirName: string): Promise<void> {
  deleteDbFiles(dbDirName);
  const accountKey = await SecureStore.getItemAsync(dbKeyId(accountId), STORE_OPTS).catch(() => null);
  const legacyKey = await SecureStore.getItemAsync(LEGACY_DB_ENCRYPTION_KEY, STORE_OPTS).catch(() => null);
  await deleteDbKey(accountId);
  if (legacyKey && (accountKey === legacyKey || accountKey === null)) {
    await deleteLegacyDbKey();
  }
}

export function deleteDbFiles(dbDirName: string): void {
  const dir = dbDirObj(dbDirName);
  if (!dir.exists) {
    try { dir.create({ intermediates: true }); } catch { }
    return;
  }
  try {
    dir.delete();
  } catch {
    try {
      for (const entry of dir.list()) {
        if (entry instanceof File) { try { entry.delete(); } catch { } }
      }
    } catch { }
    try { dir.delete(); } catch { }
  }
  try { dbDirObj(dbDirName).create({ intermediates: true }); } catch { }
}

function dbDirObj(name: string): Directory { return new Directory(Paths.document, name); }

export function ensureDbDir(name: string): Promise<string> {
  const dir = dbDirObj(name);
  if (!dir.exists) dir.create({ intermediates: true });
  const path = toFsPath(dir);
  if (__DEV__) assertWritableDir(dir, path);
  return Promise.resolve(path);
}

function toFsPath(dir: Directory): string {
  const decoded = (() => { try { return decodeURI(dir.uri); } catch { return dir.uri; } })();
  return '/' + decoded
    .replace(/^file:\/+/i, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
}

function assertWritableDir(dir: Directory, path: string): void {
  try {
    const probe = new File(dir, '.xmtp_write_probe');
    probe.write('1');
    const ok = probe.exists;
    try { probe.delete(); } catch { }
    console.log(`[xmtp] dbDirectory ready path=${path} exists=${dir.exists} writable=${ok}`);
  } catch (e) {
    console.warn(`[xmtp] dbDirectory NOT writable path=${path} exists=${dir.exists} err=${String(e)}`);
  }
}
