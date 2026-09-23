import { INSTALLATION_LIMIT_MESSAGE } from '@stage-labs/client/xmtp/clientErrors';
import { secureStorage } from '../platform/storage';
import { getActiveAccount, markRegistered, setActiveAccountId, type AccountRecord } from './accounts';
import { XMTP_ENV_KEY, type XmtpEnv } from './xmtp.types';

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
    void started.then((value) => { if (timedOut) disposeLate(value); }).catch(() => undefined);
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

const STALE_ACCOUNT_MESSAGE = 'The account changed while messaging was starting.';

export async function assertStillActiveAccount(accountId: string, discard: () => void): Promise<void> {
  let activeId: string | null;
  try {
    activeId = (await getActiveAccount())?.id ?? null;
  } catch {
    return;
  }
  if (activeId === accountId) return;
  try { discard(); } catch { }
  throw new Error(STALE_ACCOUNT_MESSAGE);
}

interface FinalizeDeps<C> {
  discard: (client: C) => void;
  setCached: (client: C) => void;
  registerPush: (client: C) => Promise<void>;
}

export function clientFinalizer<C>(deps: FinalizeDeps<C>): (
  client: C, rec: AccountRecord, env: XmtpEnv, opts: { markRegistered: boolean },
) => Promise<C> {
  return async (client, rec, env, opts) => {
    await assertStillActiveAccount(rec.id, () => { deps.discard(client); });
    deps.setCached(client);
    if (opts.markRegistered) await markRegistered(rec.id);
    await setActiveAccountId(rec.id);
    await secureStorage.set(XMTP_ENV_KEY, env);
    void deps.registerPush(client);
    return client;
  };
}
