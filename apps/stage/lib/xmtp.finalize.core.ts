import type { AccountRecord } from '@stage-labs/client/accounts/types';
import type { XmtpEnv } from './xmtp.types';
import { attempt } from './errorPolicy';

export interface FinalizeDeps<C> {
  active: () => Promise<AccountRecord | null>;
  markRegistered: (id: string) => Promise<void>;
  saveEnv: (env: XmtpEnv) => Promise<void>;
  discard: (client: C) => void;
}

export async function openFinalizedClient<C>(deps: {
  open: () => Promise<C>;
  fallback: () => Promise<C>;
  canFallback: (error: unknown) => boolean;
  finalize: (client: C) => Promise<C>;
}): Promise<C> {
  let client: C;
  try { client = await deps.open(); } catch (e) {
    if (!deps.canFallback(e)) throw e;
    client = await deps.fallback();
  }
  return deps.finalize(client);
}

export function makeClientFinalizer<C>(deps: FinalizeDeps<C>): (
  client: C, rec: AccountRecord, env: XmtpEnv, opts: { markRegistered: boolean },
) => Promise<C> {
  return async (client, rec, env, opts) => {
    const assertCurrent = async (): Promise<void> => {
      if ((await deps.active())?.id !== rec.id) throw new Error('The account changed while messaging was starting.');
    };
    try {
      await assertCurrent();
      if (opts.markRegistered) await deps.markRegistered(rec.id);
      await assertCurrent();
      await deps.saveEnv(env);
      await assertCurrent();
      return client;
    } catch (e) {
      attempt(() => { deps.discard(client); }, 'cleanup');
      throw e;
    }
  };
}
