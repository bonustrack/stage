import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { INSTALLATION_LIMIT_MESSAGE, isInstallationLimit } from '@stage-labs/client/xmtp/clientErrors';
import { attempt } from './errorPolicy';
import { AccountChangedError } from './accountSelection';

export class XmtpInstallationLimitError extends Error {
  constructor(cause?: unknown) {
    super(INSTALLATION_LIMIT_MESSAGE, { cause });
    this.name = 'XmtpInstallationLimitError';
  }
}

export interface StoreRecovery {
  isCorrupt: (error: unknown) => boolean;
  wipe: () => Promise<void>;
}

export async function withStoreRecovery<C>(store: StoreRecovery, open: () => Promise<C>, reopen: () => Promise<C>): Promise<C> {
  try {
    return await open();
  } catch (e) {
    if (!store.isCorrupt(e)) throw e;
    await store.wipe();
    return reopen();
  }
}

export interface OpenRecovery extends StoreRecovery {
  freeInstallationSlot: (() => Promise<boolean>) | null;
}

export function openWithRecovery<C>(recovery: OpenRecovery, open: (wiped: boolean) => Promise<C>): Promise<C> {
  let slotFreed = false;
  const openFreeingSlot = async (wiped: boolean): Promise<C> => {
    try {
      return await open(wiped);
    } catch (e) {
      if (!isInstallationLimit(e)) throw e;
      const free = recovery.freeInstallationSlot;
      if (slotFreed || free === null || !(await free())) throw new XmtpInstallationLimitError(e);
      slotFreed = true;
      return openFreeingSlot(wiped);
    }
  };
  return withStoreRecovery(
    recovery,
    () => openFreeingSlot(false),
    () => openFreeingSlot(true),
  );
}

export interface FinalizeDeps<C> {
  active: () => Promise<AccountRecord | null>;
  markRegistered: (id: string) => Promise<void>;
  discard: (client: C) => void;
}

export type FinalizeClient<C> = (client: C, rec: AccountRecord, opts: { markRegistered: boolean }) => Promise<C>;

export function makeClientFinalizer<C>(deps: FinalizeDeps<C>): FinalizeClient<C> {
  return async (client, rec, opts) => {
    const assertCurrent = async (): Promise<void> => {
      if ((await deps.active())?.id !== rec.id) throw new AccountChangedError('The account changed while messaging was starting.');
    };
    try {
      await assertCurrent();
      if (opts.markRegistered) await deps.markRegistered(rec.id);
      await assertCurrent();
      return client;
    } catch (e) {
      attempt(() => {
        deps.discard(client);
      }, 'cleanup');
      throw e;
    }
  };
}

export async function openFinalizedClient<C>(deps: {
  open: () => Promise<C>;
  fallback: () => Promise<C>;
  canFallback: (error: unknown) => boolean;
  finalize: (client: C) => Promise<C>;
}): Promise<C> {
  let client: C;
  try {
    client = await deps.open();
  } catch (e) {
    if (!deps.canFallback(e)) throw e;
    client = await deps.fallback();
  }
  return deps.finalize(client);
}
