/** XMTP fresh-installation create path + auto-recovery for a corrupt / key-
 *  mismatched local store, plus the boot-level EOA mint. Split out of
 *  xmtp.client.ts to keep both files under the 200-line cap.
 *
 *  On a clean reinstall the Android keystore survives the uninstall, so the
 *  persisted db-encryption-key outlives the wiped/half-written sqlite store —
 *  Client.create/build then throws a SQLCipher PRAGMA-key / StorageError /
 *  UnknownSigner. We catch those, wipe ONLY this account's XMTP store + db key
 *  (never the private key / EOA registry), and retry create exactly once. */

import * as SecureStore from 'expo-secure-store';
import { Client } from '@xmtp/react-native-sdk';
import {
  getActiveAccount, addGeneratedAccount, markRegistered, setActiveAccountId,
  type AccountRecord,
} from './accounts';
import { registerPushWithDaemon } from './push';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import { setCachedXmtpClient } from './xmtp.state';
import { type XmtpEnv } from './xmtp.types';
import { loadOrCreateDbKey, ensureDbDir, wipeXmtpStore } from './xmtp.dbkey';

/** SecureStore keys must match `[A-Za-z0-9._-]+` — colons are rejected on Android. */
const ENV_KEY = 'xmtp.env';

export interface CreateOpts {
  env: XmtpEnv;
  dbDirectory: string;
  dbEncryptionKey: Uint8Array;
  codecs: typeof XMTP_CODECS;
}

/** Mint + activate the local EOA account at app boot, INDEPENDENT of XMTP. The
 *  wallet (Snapshot signing) and Railgun (usePrivateWallet → getActiveAccountId)
 *  must always have an account even when XMTP onboarding fails on a clean
 *  reinstall (stale db key vs. wiped store). Idempotent — no-ops once an account
 *  exists, so it never disturbs multi-account state. */
export async function ensureActiveAccount(): Promise<void> {
  const existing = await getActiveAccount();
  if (!existing) await addGeneratedAccount();
}

/** Storage / key-mismatch signatures thrown by the native XMTP SDK when a stale
 *  db-encryption-key no longer matches the wiped/half-written sqlite store on a
 *  clean reinstall. Matching any of these triggers a one-shot auto-wipe + retry
 *  rather than surfacing a HomeError. */
const STORE_KEY_MISMATCH = [
  'PRAGMA key', 'StorageError', 'incorrect value',
  'UnknownSigner', 'Error creating V3 client',
];
function isStoreKeyMismatch(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return STORE_KEY_MISMATCH.some(sig => msg.includes(sig));
}

/** Run `Client.create` for a fresh installation. On a corrupt/key-mismatched
 *  local store this throws a storage/UnknownSigner error; we AUTO-WIPE this
 *  account's XMTP store + db key and retry ONCE with a fresh key. Guarded against
 *  infinite retry by `recovered`. Only the XMTP local store/key is wiped — the
 *  account's private key + EOA registry are untouched. If the retry also fails,
 *  the error surfaces to the caller's HomeError path. */
export async function createClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts, recovered = false,
): Promise<Client> {
  /** XMTP registers a new installation by asking the account to sign its
   *  handshake challenge — silent for local keys, a one-time wallet prompt
   *  for WalletConnect. */
  const signer = await signerForRecord(rec);
  let created: Client;
  try {
    created = await Client.create(signer, opts);
  } catch (e) {
    if (!recovered && isStoreKeyMismatch(e)) {
      await wipeXmtpStore(rec.dbDir);
      const dbDirectory = await ensureDbDir(rec.dbDir);
      const dbEncryptionKey = await loadOrCreateDbKey();
      return createClientForAccount(rec, env, { ...opts, dbDirectory, dbEncryptionKey }, true);
    }
    throw e;
  }
  setCachedXmtpClient(created);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await SecureStore.setItemAsync(ENV_KEY, env);
  /** Auto-register this device's push token with the daemon (fresh-install path). */
  void registerPushWithDaemon(created);
  return created;
}
