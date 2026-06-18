/** XMTP installation-create path for an account, plus narrow auto-recovery for a
 *  genuinely corrupt / key-mismatched LOCAL sqlite store, plus the boot-level EOA
 *  mint. Split out of xmtp.client.ts to keep both files under the 200-line cap.
 *
 *  Two onboarding paths must both work reliably:
 *    - GENERATED account → brand-new inbox → Client.create always succeeds.
 *    - IMPORTED account (privateKey / walletconnect) → pre-existing inbox →
 *      Client.create registers a NEW installation, which can be REJECTED by the
 *      network when the inbox already has the max (~10) installations. That is a
 *      NETWORK condition, NOT local corruption — we must NOT wipe for it.
 *
 *  Local-store corruption (SQLCipher PRAGMA key / StorageError / incorrect value)
 *  is the ONLY thing that triggers a one-shot wipe + retry of THIS account's
 *  store (per-account db key, so other accounts are never affected). */

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

/** Surfaced (non-fatal) when an imported wallet's inbox can't register another
 *  installation. The account still works for wallet / Railgun. */
const INSTALLATION_LIMIT_MESSAGE =
  'This wallet already has XMTP set up on too many devices (installation limit reached). ' +
  'Messaging is unavailable for this account — wallet features still work.';

export interface CreateOpts {
  env: XmtpEnv;
  dbDirectory: string;
  dbEncryptionKey: Uint8Array;
  codecs: typeof XMTP_CODECS;
}

/** Thrown by createClientForAccount when an imported inbox can't register a new
 *  installation. Callers treat it as a clear, NON-FATAL surface (no wipe, no
 *  loop) — onboarding still completes, wallet/Railgun still work. */
class XmtpInstallationLimitError extends Error {
  constructor() { super(INSTALLATION_LIMIT_MESSAGE); this.name = 'XmtpInstallationLimitError'; }
}

/** Revalidate the already-active account at boot (idempotent). This NEVER creates
 *  an account: a wallet exists ONLY after the user completes onboarding (the flow
 *  persists the smart account) or an explicit in-app "new account" action. The
 *  root layout calls this exclusively when the gate already reports hasAccount, so
 *  on a fresh, un-onboarded install it is a no-op and nothing is persisted — the
 *  onboarding overlay keeps showing on every launch until create/restore runs. */
export async function ensureActiveAccount(): Promise<void> {
  await getActiveAccount();
}

/** Sentinel message for the create timeout. Treated as a corruption-class signal
 *  (see isStoreCorruption) because a native hang inside `Client.create` is, in
 *  practice, a SQLCipher key/salt mismatch manifesting as an sqlite-open that
 *  never returns rather than a thrown PRAGMA error. So the one-shot wipe+retry
 *  must run on a timeout too — otherwise the account is a permanent dead spinner. */
const CREATE_TIMEOUT_MESSAGE = 'XMTP.create timed out (native handshake hang)';

/** GENUINE local-store corruption signatures: a stale db-encryption key that no
 *  longer matches the wiped/half-written sqlite store (e.g. clean reinstall where
 *  the Android keystore survived), OR a create that hangs on sqlite-open (the
 *  same key/salt mismatch surfacing as a hang → CREATE_TIMEOUT_MESSAGE). These —
 *  and ONLY these — trigger a one-shot wipe + retry of THIS account's local store.
 *  NETWORK-side create rejections (installation limit, handshake) are NOT here. */
const STORE_CORRUPTION = [
  'PRAGMA key', 'StorageError', 'incorrect value', CREATE_TIMEOUT_MESSAGE,
];
/** True when the error matches a local-store corruption signature that warrants a wipe + retry. */
export function isStoreCorruption(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return STORE_CORRUPTION.some(sig => msg.includes(sig));
}

/** A true native hang inside `Client.create` (MLS handshake / sqlite open never
 *  returns) would leave the account-switch promise pending forever → dead
 *  spinner. Race create against a 30s timeout so a hang REJECTS (then the
 *  one-shot wipe+retry runs, then the HomeError UX path) instead of spinning.
 *  Mirrors the `Client.build` timeout in xmtp.client.ts. */
const CREATE_TIMEOUT_MS = 30_000;
async function createWithTimeout(
  signer: Awaited<ReturnType<typeof signerForRecord>>, opts: CreateOpts,
): Promise<Client> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(CREATE_TIMEOUT_MESSAGE)),
      CREATE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race<Client>([Client.create(signer, opts), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Network-side signals that the inbox already has too many installations (or the
 *  new-installation handshake was rejected). Imported (pre-existing) inboxes only.
 *  We do NOT wipe for these — wiping the local store cannot free a network slot. */
const INSTALLATION_LIMIT = [
  '10/10',
  'has already registered',
  'already registered',
  'Please revoke existing installations',
  'Cannot register a new installation',
];
function isInstallationLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return INSTALLATION_LIMIT.some(sig => msg.toLowerCase().includes(sig.toLowerCase()));
}

/** Best-effort: free ONE installation slot for a pre-existing inbox by revoking
 *  its oldest installation, so a fresh Client.create can register this device.
 *  Uses the SDK 5.7 static APIs (inboxStatesForInboxIds + revokeInstallations).
 *  Returns true if a revoke was attempted successfully. Never throws. */
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
    /** Revoke not feasible (signer prompt declined, network, V3 shape mismatch) —
     *  caller surfaces the non-fatal limit message instead. */
    return false;
  }
}

async function finalizeClient(created: Client, rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  setCachedXmtpClient(created);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await SecureStore.setItemAsync(ENV_KEY, env);
  void registerPushWithDaemon(created);
  return created;
}

/** Run `Client.create` to register this device's installation.
 *
 *  Recovery is intentionally MINIMAL:
 *    - GENUINE local-store corruption → wipe THIS account's store + per-account
 *      key, retry create ONCE (guarded by `recovered`).
 *    - IMPORTED inbox installation-limit → try ONCE to revoke the oldest
 *      installation then retry create ONCE; if that's not feasible or also
 *      fails, throw XmtpInstallationLimitError (non-fatal, no loop, no wipe).
 *    - Anything else → rethrow to the caller's recoverable HomeError path.
 *  Only THIS account's local store/key is ever touched. */
export async function createClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts,
  recovered = false, slotFreed = false,
): Promise<Client> {
  const signer = await signerForRecord(rec);
  try {
    const created = await createWithTimeout(signer, opts);
    return finalizeClient(created, rec, env);
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
    /** Imported pre-existing inbox hit the installation cap. Try to free one slot
     *  ONCE, then retry create ONCE. Generated accounts can't hit this (brand-new
     *  inbox), so this only ever runs for imported wallets. */
    if (!slotFreed && isInstallationLimit(e)) {
      const freed = await tryFreeInstallationSlot(rec, env);
      if (freed) return createClientForAccount(rec, env, opts, recovered, true);
      throw new XmtpInstallationLimitError();
    }
    if (isInstallationLimit(e)) throw new XmtpInstallationLimitError();
    throw e;
  }
}
