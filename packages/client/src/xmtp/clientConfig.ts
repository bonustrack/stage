import { dbDirFor } from '../accounts/registry';
import { STORE_LOCKED_MESSAGE } from './clientErrors';
import { sleep as defaultSleep } from '../timing';

export function webXmtpDbPath(accountId: string, env: string): string {
  return `${dbDirFor(accountId)}-${env}.db3`;
}

export function canReuseSavedClient(savedAddress: string | null, savedEnv: string | null, address: string, env: string): boolean {
  return savedAddress?.toLowerCase() === address && savedEnv === env;
}

export interface OfflineOpen {
  inboxId: string;
  allowOffline: true;
}

export function offlineOpenOptions(savedInboxId: string | null, sameAccount: boolean): OfflineOpen | null {
  return sameAccount && savedInboxId ? { inboxId: savedInboxId, allowOffline: true } : null;
}

export function installationCreatedAtMs(clientTimestampNs: bigint | null | undefined): number | null {
  return clientTimestampNs != null ? Number(clientTimestampNs / 1_000_000n) : null;
}

export type PersistedClientEvent = 'open-failed' | 'installation-mismatch' | 'installation-adopted' | 'registered';

export interface PersistedClientDeps<C> {
  open: () => Promise<C>;
  isRegistered: (client: C) => Promise<boolean>;
  register: (client: C) => Promise<void>;
  installationIdOf: (client: C) => string;
  close: (client: C) => void;
  savedInstallationId: string | null | Promise<string | null>;
  retryable?: (error: unknown) => boolean;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (event: PersistedClientEvent, error?: unknown) => void;
}

export interface OpenedClient<C> {
  client: C;
  registered: boolean;
}

const OPEN_ATTEMPTS = 5;
const OPEN_RETRY_MS = 800;

function matchesSavedInstallation<C>(deps: PersistedClientDeps<C>, client: C, saved: string | null): boolean {
  return saved === null || deps.installationIdOf(client) === saved;
}

type Attempt<C> = { kind: 'ready'; client: C } | { kind: 'retry'; error: unknown; mismatched?: string } | { kind: 'fail'; error: unknown };

function closeOpenedClient<C>(deps: PersistedClientDeps<C>, client: C): void {
  try {
    deps.close(client);
  } catch {}
}

async function attemptOpen<C>(deps: PersistedClientDeps<C>, previousMismatch: string | null): Promise<Attempt<C>> {
  let client: C;
  try {
    client = await deps.open();
  } catch (e) {
    deps.onEvent?.('open-failed', e);
    return { kind: deps.retryable?.(e) === true ? 'retry' : 'fail', error: e };
  }
  try {
    if (matchesSavedInstallation(deps, client, await deps.savedInstallationId)) return { kind: 'ready', client };
  } catch (e) {
    closeOpenedClient(deps, client);
    throw e;
  }
  const installationId = deps.installationIdOf(client);
  if (previousMismatch === installationId) {
    deps.onEvent?.('installation-adopted');
    return { kind: 'ready', client };
  }
  deps.onEvent?.('installation-mismatch');
  closeOpenedClient(deps, client);
  return { kind: 'retry', error: new Error(STORE_LOCKED_MESSAGE), mismatched: installationId };
}

async function registerIfNeeded<C>(deps: PersistedClientDeps<C>, client: C): Promise<OpenedClient<C>> {
  try {
    if (await deps.isRegistered(client)) return { client, registered: false };
    await deps.register(client);
    deps.onEvent?.('registered');
    return { client, registered: true };
  } catch (e) {
    closeOpenedClient(deps, client);
    throw e;
  }
}

export async function openPersistedClient<C>(deps: PersistedClientDeps<C>): Promise<OpenedClient<C>> {
  const attempts = deps.attempts ?? OPEN_ATTEMPTS;
  const sleep = deps.sleep ?? defaultSleep;
  let previousMismatch: string | null = null;
  for (let attempt = 1; ; attempt += 1) {
    const result: Attempt<C> = await attemptOpen(deps, previousMismatch);
    if (result.kind === 'ready') return registerIfNeeded(deps, result.client);
    if (result.kind === 'fail' || attempt >= attempts) throw result.error;
    previousMismatch = result.mismatched ?? previousMismatch;
    await sleep(OPEN_RETRY_MS);
  }
}
