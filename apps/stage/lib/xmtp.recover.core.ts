import { INSTALLATION_LIMIT_MESSAGE } from '@stage-labs/client/xmtp/clientErrors';
import { secureStorage } from '../platform/storage';
import { getActiveAccount, getSelectedAccount, markRegistered, type AccountRecord } from './accounts';
import { XMTP_ENV_KEY, type XmtpEnv } from './xmtp.types';
import { ignored } from './errorPolicy';
import { makeClientFinalizer, type FinalizeDeps } from './xmtp.finalize.core';

export class XmtpInstallationLimitError extends Error {
  constructor() { super(INSTALLATION_LIMIT_MESSAGE); this.name = 'XmtpInstallationLimitError'; }
}

export async function ensureActiveAccount(): Promise<void> {
  await getActiveAccount();
}

export async function withCreateTimeout<C>(
  run: () => Promise<C>, ms: number, message: string, disposeLate?: (value: C) => void,
): Promise<C> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const started = run();
  if (disposeLate) {
    void started.then((value) => { if (timedOut) disposeLate(value); }).catch(ignored(undefined, 'cleanup'));
  }
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { timedOut = true; reject(new Error(message)); }, ms);
  });
  try {
    return await Promise.race<C>([started, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function clientFinalizer<C>(deps: Pick<FinalizeDeps<C>, 'discard'>): (
  client: C, rec: AccountRecord, env: XmtpEnv, opts: { markRegistered: boolean },
) => Promise<C> {
  return makeClientFinalizer({
    ...deps, active: getSelectedAccount, markRegistered,
    saveEnv: (env) => secureStorage.set(XMTP_ENV_KEY, env),
  });
}
