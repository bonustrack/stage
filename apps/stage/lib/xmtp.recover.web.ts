
import { Client } from '@xmtp/browser-sdk';
import { secureStorage } from '../platform/storage';
import {
  getActiveAccount, markRegistered, setActiveAccountId,
  type AccountRecord,
} from './accounts';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import { setCachedXmtpClient } from './xmtp.state.web';
import { whileRegistering } from './xmtp.state.core';
import { registerPushWithServer } from './pushRegister.web';
import { perfLog } from './perf';
import { errorMessage } from '@stage-labs/client/errors';
import { openPersistedClient, type OpenedClient } from '@stage-labs/client/xmtp/clientConfig';
import { assertStillActiveAccount, withCreateTimeout } from './xmtp.recover.core';
import { type XmtpEnv, XMTP_ENV_KEY } from './xmtp.types';
import { deleteDbKey, deleteDbFiles } from './xmtp.dbkey';
import {
  INSTALLATION_LIMIT_MESSAGE, isInstallationLimit, isStoreLocked,
  isStoreCorruption as isStoreCorruptionCore,
} from '@stage-labs/client/xmtp/clientErrors';


export interface CreateOpts {
  env: XmtpEnv;
  dbPath: string;
  codecs: typeof XMTP_CODECS;
  historySyncUrl?: string;
}

class XmtpInstallationLimitError extends Error {
  constructor() { super(INSTALLATION_LIMIT_MESSAGE); this.name = 'XmtpInstallationLimitError'; }
}

export async function ensureActiveAccount(): Promise<void> {
  await getActiveAccount();
}

const NOISY_OPEN_EVENTS = new Set(['installation-mismatch', 'open-failed']);

function reportOpenEvent(event: string, savedInstallationId: string | null, e?: unknown): void {
  const detail = { saved: savedInstallationId ?? '', error: e === undefined ? '' : errorMessage(e) };
  perfLog(`xmtp.client.open ${event}`, detail);
  if (NOISY_OPEN_EVENTS.has(event)) console.warn(`[stage] xmtp store open ${event}`, detail);
}

const CREATE_TIMEOUT_MS = 45_000;
const CREATE_TIMEOUT_MESSAGE = 'Opening the local message store timed out.';

export function isStoreCorruption(err: unknown): boolean {
  return isStoreCorruptionCore(err);
}

type WebXmtpClient = Client<unknown>;

async function finalizeClient(
  created: WebXmtpClient, rec: AccountRecord, env: XmtpEnv,
): Promise<WebXmtpClient> {
  await assertStillActiveAccount(rec.id, () => { created.close(); });
  setCachedXmtpClient(created);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await secureStorage.set(XMTP_ENV_KEY, env);
  void registerPushWithServer(created);
  return created;
}

async function wipeWebXmtpStore(rec: AccountRecord): Promise<void> {
  await deleteDbFiles(rec.dbDir);
  await deleteDbKey(rec.id);
}

export async function openClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts, savedInstallationId: string | null, recovered = false,
): Promise<OpenedClient<WebXmtpClient>> {
  const signer = await signerForRecord(rec);
  try {
    const opened = await openPersistedClient<WebXmtpClient>({
      open: () => withCreateTimeout(
        () => Client.create(signer, { ...opts, disableAutoRegister: true }),
        CREATE_TIMEOUT_MS, CREATE_TIMEOUT_MESSAGE,
        (late) => { try { late.close(); } catch { } },
      ),
      isRegistered: (client) => client.isRegistered(),
      register: (client) => whileRegistering(async () => { await client.register(); }),
      installationIdOf: (client) => client.installationId ?? '',
      close: (client) => { client.close(); },
      savedInstallationId,
      retryable: isStoreLocked,
      onEvent: (event, e) => { reportOpenEvent(event, savedInstallationId, e); },
    });
    await finalizeClient(opened.client, rec, env);
    return opened;
  } catch (e) {
    if (!recovered && isStoreCorruption(e)) {
      await wipeWebXmtpStore(rec);
      return openClientForAccount(rec, env, opts, null, true);
    }
    if (isInstallationLimit(e)) throw new XmtpInstallationLimitError();
    throw e;
  }
}
