
import { Client } from '@xmtp/browser-sdk';
import { secureStorage } from '../platform/storage';
import {
  getActiveAccount, markRegistered, setActiveAccountId,
  type AccountRecord,
} from './accounts';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import { setCachedXmtpClient } from './xmtp.state.web';
import { type XmtpEnv } from './xmtp.types';
import { deleteDbKey, deleteDbFiles } from './xmtp.dbkey';
import {
  INSTALLATION_LIMIT_MESSAGE, isInstallationLimit,
  isStoreCorruption as isStoreCorruptionCore,
} from '@stage-labs/client/xmtp/clientErrors';

const ENV_KEY = 'xmtp.env';

export interface CreateOpts {
  env: XmtpEnv;
  dbPath: string;
  codecs: typeof XMTP_CODECS;
}

class XmtpInstallationLimitError extends Error {
  constructor() { super(INSTALLATION_LIMIT_MESSAGE); this.name = 'XmtpInstallationLimitError'; }
}

export async function ensureActiveAccount(): Promise<void> {
  await getActiveAccount();
}

export function isStoreCorruption(err: unknown): boolean {
  return isStoreCorruptionCore(err);
}

type WebXmtpClient = Client<unknown>;

async function finalizeClient(
  created: WebXmtpClient, rec: AccountRecord, env: XmtpEnv,
): Promise<WebXmtpClient> {
  setCachedXmtpClient(created);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await secureStorage.set(ENV_KEY, env);
  return created;
}

async function wipeWebXmtpStore(rec: AccountRecord): Promise<void> {
  deleteDbFiles(rec.dbDir);
  await deleteDbKey(rec.id);
}

export async function createClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts, recovered = false,
): Promise<WebXmtpClient> {
  const signer = await signerForRecord(rec);
  try {
    const created = await Client.create(signer, opts);
    return await finalizeClient(created, rec, env);
  } catch (e) {
    if (!recovered && isStoreCorruption(e)) {
      await wipeWebXmtpStore(rec);
      return createClientForAccount(rec, env, opts, true);
    }
    if (isInstallationLimit(e)) throw new XmtpInstallationLimitError();
    throw e;
  }
}
