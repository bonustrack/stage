import { dbDirFor } from '../accounts/registry';
import { STORE_LOCKED_MESSAGE } from './clientErrors';

export function webXmtpDbPath(accountId: string, env: string): string {
  return `${dbDirFor(accountId)}-${env}.db3`;
}

export function canReuseSavedClient(
  savedAddress: string | null,
  savedEnv: string | null,
  address: string,
  env: string,
): boolean {
  return savedAddress?.toLowerCase() === address && savedEnv === env;
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
  savedInstallationId: string | null;
  retryable?: (error: unknown) => boolean;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (event: PersistedClientEvent, error?: unknown) => void;
}

export interface OpenedClient<C> { client: C; registered: boolean }

export const OPEN_ATTEMPTS = 5;
export const OPEN_RETRY_MS = 800;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function matchesSavedInstallation<C>(deps: PersistedClientDeps<C>, client: C): boolean {
  return deps.savedInstallationId === null || deps.installationIdOf(client) === deps.savedInstallationId;
}

type Attempt<C> =
  | { kind: 'ready'; client: C }
  | { kind: 'retry'; error: unknown; mismatched?: string }
  | { kind: 'fail'; error: unknown };

function mismatchIsPersistent(previous: string | null, current: string): boolean {
  return previous !== null && previous === current;
}

async function attemptOpen<C>(deps: PersistedClientDeps<C>, previousMismatch: string | null): Promise<Attempt<C>> {
  let client: C;
  try {
    client = await deps.open();
  } catch (e) {
    deps.onEvent?.('open-failed', e);
    return { kind: deps.retryable?.(e) === true ? 'retry' : 'fail', error: e };
  }
  if (matchesSavedInstallation(deps, client)) return { kind: 'ready', client };
  const installationId = deps.installationIdOf(client);
  if (mismatchIsPersistent(previousMismatch, installationId)) {
    deps.onEvent?.('installation-adopted');
    return { kind: 'ready', client };
  }
  deps.onEvent?.('installation-mismatch');
  try { deps.close(client); } catch { }
  return { kind: 'retry', error: new Error(STORE_LOCKED_MESSAGE), mismatched: installationId };
}

async function registerIfNeeded<C>(deps: PersistedClientDeps<C>, client: C): Promise<OpenedClient<C>> {
  if (await deps.isRegistered(client)) return { client, registered: false };
  await deps.register(client);
  deps.onEvent?.('registered');
  return { client, registered: true };
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
