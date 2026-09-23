import { Client } from '@xmtp/browser-sdk';
import type { AccountRecord } from './accounts';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import { setCachedXmtpClient } from './xmtp.state.web';
import { whileRegistering } from './xmtp.state.core';
import { registerPushWithServer } from './pushRegister.web';
import { perfLog } from './perf';
import { errorMessage } from '@stage-labs/client/errors';
import { openPersistedClient, type OpenedClient } from '@stage-labs/client/xmtp/clientConfig';
import { XmtpInstallationLimitError, clientFinalizer, withCreateTimeout } from './xmtp.recover.core';
import type { XmtpEnv } from './xmtp.types';
import { wipeXmtpStore } from './xmtp.dbkey';
import { isInstallationLimit, isStoreLocked, isStoreCorruption } from '@stage-labs/client/xmtp/clientErrors';
import { attempt } from './errorPolicy';

export interface CreateOpts {
  env: XmtpEnv;
  dbPath: string;
  codecs: typeof XMTP_CODECS;
  historySyncUrl?: string;
}

const NOISY_OPEN_EVENTS = new Set(['installation-mismatch', 'open-failed']);

function reportOpenEvent(event: string, savedInstallationId: string | null, e?: unknown): void {
  const detail = { saved: savedInstallationId ?? '', error: e === undefined ? '' : errorMessage(e) };
  perfLog(`xmtp.client.open ${event}`, detail);
  if (NOISY_OPEN_EVENTS.has(event)) console.warn(`[stage] xmtp store open ${event}`, detail);
}

const CREATE_TIMEOUT_MS = 45_000;
const CREATE_TIMEOUT_MESSAGE = 'Opening the local message store timed out.';

type WebXmtpClient = Client<unknown>;

const finalizeClient = clientFinalizer<WebXmtpClient>({
  discard: (client) => { client.close(); },
  setCached: setCachedXmtpClient,
  registerPush: registerPushWithServer,
});

export async function openClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts, savedInstallationId: string | null, recovered = false,
): Promise<OpenedClient<WebXmtpClient>> {
  const signer = await signerForRecord(rec);
  try {
    const opened = await openPersistedClient<WebXmtpClient>({
      open: () => withCreateTimeout(
        () => Client.create(signer, { ...opts, disableAutoRegister: true }),
        CREATE_TIMEOUT_MS, CREATE_TIMEOUT_MESSAGE,
        (late) => { attempt(() => { late.close(); }, 'cleanup'); },
      ),
      isRegistered: (client) => client.isRegistered(),
      register: (client) => whileRegistering(async () => { await client.register(); }),
      installationIdOf: (client) => client.installationId ?? '',
      close: (client) => { client.close(); },
      savedInstallationId,
      retryable: isStoreLocked,
      onEvent: (event, e) => { reportOpenEvent(event, savedInstallationId, e); },
    });
    await finalizeClient(opened.client, rec, env, { markRegistered: true });
    return opened;
  } catch (e) {
    if (!recovered && isStoreCorruption(e)) {
      await wipeXmtpStore(rec.id, rec.dbDir);
      return openClientForAccount(rec, env, opts, null, true);
    }
    if (isInstallationLimit(e)) throw new XmtpInstallationLimitError();
    throw e;
  }
}
