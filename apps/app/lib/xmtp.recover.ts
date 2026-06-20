/** @file XMTP installation-create path for an account, with narrow one-shot wipe-and-retry auto-recovery limited to genuinely corrupt local sqlite stores (never network installation-limit rejections), plus the boot-level EOA mint; split out of xmtp.client.ts for the line cap. */

import * as SecureStore from 'expo-secure-store';
import { Client, PublicIdentity } from '@xmtp/react-native-sdk';
import {
  getActiveAccount, markRegistered, setActiveAccountId,
  type AccountRecord,
} from './accounts';
import { registerPushWithDaemon } from './push';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import { setCachedXmtpClient } from './xmtp.state';
import { type XmtpEnv } from './xmtp.types';
import { loadOrCreateDbKey, ensureDbDir, wipeXmtpStore } from './xmtp.dbkey';

/** SecureStore keys must match `[A-Za-z0-9._-]+` — colons are rejected on Android. */
const ENV_KEY = 'xmtp.env';

/** Surfaced (non-fatal) when an imported wallet's inbox can't register another installation. The account still works for wallet / Railgun. */
const INSTALLATION_LIMIT_MESSAGE =
  'This wallet already has XMTP set up on too many devices (installation limit reached). ' +
  'Messaging is unavailable for this account — wallet features still work.';

export interface CreateOpts {
  env: XmtpEnv;
  dbDirectory: string;
  dbEncryptionKey: Uint8Array;
  codecs: typeof XMTP_CODECS;
}

/** Thrown by createClientForAccount when an imported inbox can't register a new installation. Callers treat it as a clear, NON-FATAL surface (no wipe, no loop) — onboarding still completes, wallet/Railgun still work. */
class XmtpInstallationLimitError extends Error {
  constructor() { super(INSTALLATION_LIMIT_MESSAGE); this.name = 'XmtpInstallationLimitError'; }
}

/** Revalidate the already-active account at boot (idempotent); never creates an account, so on a fresh un-onboarded install it is a no-op and the onboarding overlay keeps showing until create/restore runs. */
export async function ensureActiveAccount(): Promise<void> {
  await getActiveAccount();
}

/** Sentinel for the create timeout, treated as a corruption-class signal because a native hang inside Client.create is in practice a SQLCipher key/salt mismatch surfacing as a never-returning sqlite-open, so the one-shot wipe+retry must run on timeout too. */
const CREATE_TIMEOUT_MESSAGE = 'XMTP.create timed out (native handshake hang)';

/** Genuine local-store corruption signatures (stale db-encryption key vs a wiped/half-written sqlite store, or a sqlite-open hang surfacing as CREATE_TIMEOUT_MESSAGE) that — and only which — trigger a one-shot wipe + retry of THIS account's store; network-side rejections are excluded. */
const STORE_CORRUPTION = [
  'PRAGMA key', 'StorageError', 'incorrect value', CREATE_TIMEOUT_MESSAGE,
];
/** True when the error matches a local-store corruption signature that warrants a wipe + retry. */
export function isStoreCorruption(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return STORE_CORRUPTION.some(sig => msg.includes(sig));
}

/** Race Client.create against a 30s timeout so a true native hang (MLS handshake / sqlite-open never returning) rejects — kicking off the wipe+retry then HomeError path — instead of leaving the account-switch promise pending forever. */
const CREATE_TIMEOUT_MS = 30_000;
/** Create the With Timeout. */
async function createWithTimeout(
  signer: Awaited<ReturnType<typeof signerForRecord>>, opts: CreateOpts,
): Promise<Client> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => { reject(new Error(CREATE_TIMEOUT_MESSAGE)); },
      CREATE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race<Client>([Client.create(signer, opts), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Network-side signals that the inbox already has too many installations (or the new-installation handshake was rejected). Imported (pre-existing) inboxes only. We do NOT wipe for these — wiping the local store cannot free a network slot. */
const INSTALLATION_LIMIT = [
  '10/10',
  'has already registered',
  'already registered',
  'Please revoke existing installations',
  'Cannot register a new installation',
];
/** Whether Installation Limit. */
function isInstallationLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return INSTALLATION_LIMIT.some(sig => msg.toLowerCase().includes(sig.toLowerCase()));
}

/** Best-effort: free ONE installation slot for a pre-existing inbox by revoking its oldest installation (SDK 5.7 static APIs) so a fresh Client.create can register this device; returns true if a revoke was attempted and never throws. */
async function tryFreeInstallationSlot(rec: AccountRecord, env: XmtpEnv): Promise<boolean> {
  try {
    const identity = new PublicIdentity(rec.address, 'ETHEREUM');
    const inboxId = await Client.getOrCreateInboxId(identity, env);
    const states = await Client.inboxStatesForInboxIds(env, [inboxId]);
    const installs = states[0]?.installations ?? [];
    if (installs.length === 0) return false;
    /** Revoke the OLDEST installation to free a slot (keep newer/active ones). */
    const oldest = [...installs].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    )[0];
    if (!oldest?.id) return false;
    const signer = await signerForRecord(rec);
    await Client.revokeInstallations(
      env, signer, inboxId,
      [oldest.id as unknown as Parameters<typeof Client.revokeInstallations>[3][number]],
    );
    return true;
  } catch {
    /** Revoke not feasible (signer prompt declined, network, V3 shape mismatch) — caller surfaces the non-fatal limit message instead. */
    return false;
  }
}

/** Finalize Client. */
async function finalizeClient(created: Client, rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  setCachedXmtpClient(created);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await SecureStore.setItemAsync(ENV_KEY, env);
  void registerPushWithDaemon(created);
  return created;
}

/** Run Client.create to register this device's installation, with minimal recovery: genuine corruption wipes+retries this account's store once, an imported-inbox installation limit tries once to revoke the oldest slot then retry (else throws non-fatally), and anything else rethrows to the HomeError path. */
export async function createClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts,
  recovered = false, slotFreed = false,
): Promise<Client> {
  const signer = await signerForRecord(rec);
  try {
    const created = await createWithTimeout(signer, opts);
    return await finalizeClient(created, rec, env);
  } catch (e) {
    /** Real local corruption → wipe THIS account's store + key, retry once. */
    if (!recovered && isStoreCorruption(e)) {
      await wipeXmtpStore(rec.id, rec.dbDir);
      const dbDirectory = await ensureDbDir(rec.dbDir);
      const dbEncryptionKey = await loadOrCreateDbKey(rec.id);
      return createClientForAccount(
        rec, env, { ...opts, dbDirectory, dbEncryptionKey }, true, slotFreed,
      );
    }
    /** Imported pre-existing inbox hit the installation cap. Try to free one slot ONCE, then retry create ONCE. Generated accounts can't hit this (brand-new inbox), so this only ever runs for imported wallets. */
    if (!slotFreed && isInstallationLimit(e)) {
      const freed = await tryFreeInstallationSlot(rec, env);
      if (freed) return createClientForAccount(rec, env, opts, recovered, true);
      throw new XmtpInstallationLimitError();
    }
    if (isInstallationLimit(e)) throw new XmtpInstallationLimitError();
    throw e;
  }
}
