import { Client, PublicIdentity } from '@xmtp/react-native-sdk';
import type { AccountRecord } from './accounts';
import { registerPushWithServer } from './pushRegister';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import { setCachedXmtpClient } from './xmtp.state';
import type { XmtpEnv } from './xmtp.types';
import { loadOrCreateDbKey, ensureDbDir, wipeXmtpStore } from './xmtp.dbkey';
import { isInstallationLimit, isStoreCorruption as isStoreCorruptionCore } from '@stage-labs/client/xmtp/clientErrors';
import { XmtpInstallationLimitError, clientFinalizer, withCreateTimeout } from './xmtp.recover.core';

export interface CreateOpts {
  env: XmtpEnv;
  dbDirectory: string;
  dbEncryptionKey: Uint8Array;
  codecs: typeof XMTP_CODECS;
}

const CREATE_TIMEOUT_MESSAGE = 'XMTP.create timed out (native handshake hang)';

export function isStoreCorruption(err: unknown): boolean {
  return isStoreCorruptionCore(err, [CREATE_TIMEOUT_MESSAGE]);
}

const CREATE_TIMEOUT_MS = 60_000;
function createWithTimeout(
  signer: Awaited<ReturnType<typeof signerForRecord>>, opts: CreateOpts,
): Promise<Client> {
  return withCreateTimeout(() => Client.create(signer, opts), CREATE_TIMEOUT_MS, CREATE_TIMEOUT_MESSAGE);
}

async function tryFreeInstallationSlot(rec: AccountRecord, env: XmtpEnv): Promise<boolean> {
  try {
    const identity = new PublicIdentity(rec.address, 'ETHEREUM');
    const inboxId = await Client.getOrCreateInboxId(identity, env);
    const states = await Client.inboxStatesForInboxIds(env, [inboxId]);
    const installs = states[0]?.installations ?? [];
    if (installs.length === 0) return false;
    const oldest = [...installs].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    )[0];
    if (!oldest?.id) return false;
    const signer = await signerForRecord(rec);
    await Client.revokeInstallations(
      env, signer, inboxId,
      [oldest.id as Parameters<typeof Client.revokeInstallations>[3][number]],
    );
    return true;
  } catch {
    return false;
  }
}

export const finalizeClient = clientFinalizer<Client>({
  discard: () => undefined,
  setCached: setCachedXmtpClient,
  registerPush: registerPushWithServer,
});

export async function createClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts,
  recovered = false, slotFreed = false,
): Promise<Client> {
  const signer = await signerForRecord(rec);
  try {
    const created = await createWithTimeout(signer, opts);
    return await finalizeClient(created, rec, env, { markRegistered: true });
  } catch (e) {
    if (!recovered && isStoreCorruption(e)) {
      await wipeXmtpStore(rec.id, rec.dbDir);
      const dbDirectory = await ensureDbDir(rec.dbDir);
      const dbEncryptionKey = await loadOrCreateDbKey(rec.id);
      return createClientForAccount(
        rec, env, { ...opts, dbDirectory, dbEncryptionKey }, true, slotFreed,
      );
    }
    if (!slotFreed && isInstallationLimit(e)) {
      const freed = await tryFreeInstallationSlot(rec, env);
      if (freed) return createClientForAccount(rec, env, opts, recovered, true);
      throw new XmtpInstallationLimitError();
    }
    if (isInstallationLimit(e)) throw new XmtpInstallationLimitError();
    throw e;
  }
}
