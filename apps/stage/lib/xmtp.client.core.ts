import type { AccountRecord } from '@stage-labs/client/accounts/types';
import type { HmacKeysByTopic } from '@stage-labs/client/xmtp/pushServer';
import type { FinalizeClient } from './xmtp.recover.core';
import { report, reported } from './errorPolicy';
import { NoAccountError } from './accountSelection';

export interface XmtpInstallation {
  id: string;
  createdAt: number | undefined;
  current: boolean;
}

export function installationsOf(list: { id: string; createdAt: number | undefined }[], currentId: string | undefined): XmtpInstallation[] {
  return list
    .map((i) => ({ id: i.id, createdAt: i.createdAt, current: i.id === currentId }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export interface GroupName {
  id: string;
  name: string;
}

interface PushSdk<C> {
  signWithInstallationKey: (client: C, text: string) => Promise<Uint8Array>;
  topics: (client: C) => Promise<string[]>;
  hmacKeys: (client: C, topic?: string) => Promise<HmacKeysByTopic>;
  groupNames: (client: C) => Promise<GroupName[]>;
}

interface ClientReads<C> {
  selfAddressOf: (client: C) => string | null;
  syncPreferences: (client: C) => Promise<unknown>;
  installations: (client: C) => Promise<{ id: string; createdAt: number | undefined }[]>;
  installationIdOf: (client: C) => string | undefined;
  revoke: (client: C, account: AccountRecord, installationId: string) => Promise<void>;
}

export interface ClientSdk<C> extends ClientReads<C> {
  inboxIdOf: (client: C) => string;
  build: (rec: AccountRecord, finalize: FinalizeClient<C>) => Promise<C>;
  isRegistered: (address: string) => Promise<boolean>;
  forgetStore: (accountId: string) => Promise<void>;
  forgetSaved: (accountId: string) => Promise<void>;
  push: PushSdk<C>;
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

interface ClientPort<C> extends ClientReads<C> {
  get: () => C | null;
  getOrCreate: (create: () => Promise<C>) => Promise<C>;
  build: (rec: AccountRecord) => Promise<C>;
  ready?: (client: C) => Promise<void>;
  dispose: () => void;
}

interface LifecycleDeps<C> {
  accounts: AccountPort;
  store: StorePort;
  client: ClientPort<C>;
  bumpEpoch: () => void;
}

function accountSwitching<C>(deps: LifecycleDeps<C>) {
  const { accounts, store, client } = deps;
  return {
    switchToAccount: async (id: string): Promise<C> => {
      const rec = (await accounts.list()).find((a) => a.id === id);
      if (!rec) throw new Error('Account not found.');
      client.dispose();
      await accounts.setActive(id);
      try {
        const built = await client.getOrCreate(() => client.build(rec));
        deps.bumpEpoch();
        if (client.ready) void client.ready(built).catch(reported('xmtp.push'));
        return built;
      } catch (e) {
        deps.bumpEpoch();
        throw e;
      }
    },
    deleteAccount: async (id: string): Promise<void> => {
      const rec = (await accounts.list()).find((a) => a.id === id);
      await accounts.remove(id);
      if (rec) await store.deleteFiles(rec.dbDir);
      await store.deleteKey(id);
      await store.forgetSaved(id);
      client.dispose();
      deps.bumpEpoch();
    },
    resetActiveXmtpStore: async (): Promise<void> => {
      const rec = await accounts.active();
      if (!rec) return;
      client.dispose();
      await store.wipe(rec.id, rec.dbDir);
      await store.forgetSaved(rec.id);
    },
  };
}

export function makeClientLifecycle<C>(deps: LifecycleDeps<C>) {
  const { accounts, client } = deps;
  const createForActive = async (): Promise<C> => {
    let created = false;
    const built = await client.getOrCreate(async () => {
      const account = await accounts.active();
      if (!account) throw new NoAccountError();
      const value = await client.build(account);
      created = true;
      return value;
    });
    if (created && client.ready) void client.ready(built).catch(reported('xmtp.push'));
    return built;
  };
  const xmtpClient = async (): Promise<C> => client.get() ?? (await createForActive());
  return {
    ...accountSwitching(deps),
    xmtpClient,
    cachedSelfEthAddress: (): string | null => {
      const cached = client.get();
      return cached ? client.selfAddressOf(cached) : null;
    },
    selfEthAddress: async (): Promise<string | null> => {
      return client.selfAddressOf(await xmtpClient());
    },
    syncPreferences: async (): Promise<void> => {
      try {
        const cached = client.get();
        if (cached) await client.syncPreferences(cached);
      } catch (err) {
        report('xmtp.syncPreferences', err);
      }
    },
    listXmtpInstallations: async (): Promise<XmtpInstallation[]> => {
      const c = await xmtpClient();
      return installationsOf(await client.installations(c), client.installationIdOf(c));
    },
    revokeXmtpInstallation: async (installationId: string): Promise<void> => {
      const c = await xmtpClient();
      const account = await accounts.active();
      if (!account) throw new NoAccountError();
      await client.revoke(c, account, installationId);
    },
  };
}
