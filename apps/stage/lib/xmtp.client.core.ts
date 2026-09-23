import type { AccountRecord } from '@stage-labs/client/accounts/types';
import type { XmtpEnv } from './xmtp.types';
import { report } from './errorPolicy';

export class NoAccountError extends Error {
  constructor() { super('No account: onboarding not completed yet.'); this.name = 'NoAccountError'; }
}

export interface XmtpInstallation {
  id: string;
  createdAt: number | undefined;
  current: boolean;
}

export function installationsOf(
  list: { id: string; createdAt: number | undefined }[], currentId: string | undefined,
): XmtpInstallation[] {
  return list
    .map(i => ({ id: i.id, createdAt: i.createdAt, current: i.id === currentId }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

interface AccountPort {
  active: () => Promise<AccountRecord | null>;
  list: () => Promise<AccountRecord[]>;
  setActive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<unknown>;
}

interface StorePort {
  deleteFiles: (dbDir: string) => Promise<void>;
  deleteKey: (accountId: string) => Promise<void>;
  wipe: (accountId: string, dbDir: string) => Promise<void>;
  forgetSaved: (accountId: string) => Promise<void>;
}

interface ClientPort<C> {
  get: () => C | null;
  getOrCreate: (create: () => Promise<C>) => Promise<C>;
  build: (rec: AccountRecord, env: XmtpEnv) => Promise<C>;
  dispose: () => void;
  selfAddressOf: (client: C) => string | null;
  syncPreferences: (client: C) => Promise<unknown>;
  installations: (client: C) => Promise<{ id: string; createdAt: number | undefined }[]>;
  installationIdOf: (client: C) => string | undefined;
  revoke: (client: C, account: AccountRecord, installationId: string) => Promise<void>;
}

export interface LifecycleDeps<C> {
  accounts: AccountPort;
  store: StorePort;
  client: ClientPort<C>;
  bumpEpoch: () => void;
}

function accountSwitching<C>(deps: LifecycleDeps<C>): {
  switchToAccount: (id: string, env?: XmtpEnv) => Promise<C>;
  deleteAccount: (id: string) => Promise<void>;
  resetActiveXmtpStore: () => Promise<void>;
} {
  const { accounts, store, client } = deps;
  return {
    async switchToAccount(id, env = 'production') {
      const rec = (await accounts.list()).find(a => a.id === id);
      if (!rec) throw new Error('Account not found.');
      client.dispose();
      await accounts.setActive(id);
      try {
        const built = await client.getOrCreate(() => client.build(rec, env));
        deps.bumpEpoch();
        return built;
      } catch (e) {
        deps.bumpEpoch();
        throw e;
      }
    },
    async deleteAccount(id) {
      const rec = (await accounts.list()).find(a => a.id === id);
      await accounts.remove(id);
      if (rec) await store.deleteFiles(rec.dbDir);
      await store.deleteKey(id);
      await store.forgetSaved(id);
      client.dispose();
    },
    async resetActiveXmtpStore() {
      const rec = await accounts.active();
      if (!rec) return;
      client.dispose();
      await store.wipe(rec.id, rec.dbDir);
      await store.forgetSaved(rec.id);
    },
  };
}

export function makeClientLifecycle<C>(deps: LifecycleDeps<C>): ReturnType<typeof accountSwitching<C>> & {
  getOrCreateXmtpClient: (env?: XmtpEnv) => Promise<C>;
  xmtpClient: () => Promise<C>;
  cachedSelfEthAddress: () => string | null;
  selfEthAddress: () => Promise<string | null>;
  syncPreferences: () => Promise<void>;
  listXmtpInstallations: () => Promise<XmtpInstallation[]>;
  revokeXmtpInstallation: (installationId: string) => Promise<void>;
} {
  const { accounts, client } = deps;
  const getOrCreateXmtpClient = (env: XmtpEnv = 'production'): Promise<C> => client.getOrCreate(async () => {
    const account = await accounts.active();
    if (!account) throw new NoAccountError();
    return client.build(account, env);
  });
  const xmtpClient = async (): Promise<C> => client.get() ?? await getOrCreateXmtpClient('production');
  return {
    ...accountSwitching(deps),
    getOrCreateXmtpClient,
    xmtpClient,
    cachedSelfEthAddress() {
      const cached = client.get();
      return cached ? client.selfAddressOf(cached) : null;
    },
    async selfEthAddress() { return client.selfAddressOf(await xmtpClient()); },
    async syncPreferences() {
      try {
        const cached = client.get();
        if (cached) await client.syncPreferences(cached);
      } catch (err) {
        report('xmtp.syncPreferences', err);
      }
    },
    async listXmtpInstallations() {
      const c = await xmtpClient();
      return installationsOf(await client.installations(c), client.installationIdOf(c));
    },
    async revokeXmtpInstallation(installationId) {
      const c = await xmtpClient();
      const account = await accounts.active();
      if (!account) throw new NoAccountError();
      await client.revoke(c, account, installationId);
    },
  };
}
