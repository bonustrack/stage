
import { ref, type Ref } from 'vue';
import type { Hex } from 'viem';
import {
  createAccountStore, type KeyValueStore, type AccountStore,
} from '@stage-labs/client/accounts/store';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import {
  PK_PREFIX, normalizePk, privateKeyFromMnemonic, accountIdFromPk, canExportPrivateKey,
} from '@stage-labs/client/accounts/keys';

export type { AccountRecord };
export { canExportPrivateKey };

const LEGACY_PK_KEY = 'xmtp.privateKey';

const kv: KeyValueStore = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => { localStorage.setItem(key, value); },
  remove: (key) => { localStorage.removeItem(key); },
};

const store: AccountStore = createAccountStore(kv);

export const accountEpoch: Ref<number> = ref(0);

export function bumpAccountEpoch(): void {
  accountEpoch.value += 1;
}

function pkKey(id: string): string {
  return PK_PREFIX + id;
}

function storePk(id: string, pk: Hex): void {
  localStorage.setItem(pkKey(id), pk);
}

export function loadPk(id: string): Hex | null {
  const raw = localStorage.getItem(pkKey(id));
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  return raw.toLowerCase() as Hex;
}

function deletePk(id: string): void {
  localStorage.removeItem(pkKey(id));
}

function adoptLegacyKey(): { id: string; pk: Hex } | null {
  const legacy = localStorage.getItem(LEGACY_PK_KEY);
  if (!legacy || !/^0x[0-9a-fA-F]{64}$/.test(legacy)) return null;
  const pk = normalizePk(legacy);
  const id = accountIdFromPk(pk);
  return { id, pk };
}

async function ensureMigrated(): Promise<void> {
  const list = await store.loadAccounts();
  if (list.length) return;
  const adopted = adoptLegacyKey();
  if (!adopted) return;
  storePk(adopted.id, adopted.pk);
  await store.addLocalAccount(adopted.id, adopted.id, 'generated');
  await store.setActiveAccountId(adopted.id);
}

export async function listAccounts(): Promise<AccountRecord[]> {
  await ensureMigrated();
  return store.loadAccounts();
}

export async function getActiveAccountId(): Promise<string | null> {
  await ensureMigrated();
  return store.getActiveAccountId();
}

export async function getActiveAccount(): Promise<AccountRecord | null> {
  await ensureMigrated();
  return store.getActiveAccount();
}

async function addLocalPkAccount(
  pk: Hex,
  type: 'generated' | 'privateKey',
): Promise<AccountRecord> {
  await ensureMigrated();
  const id = accountIdFromPk(pk);
  storePk(id, pk);
  const record = await store.addLocalAccount(id, id, type);
  const active = await store.getActiveAccountId();
  if (!active) await store.setActiveAccountId(id);
  return record;
}

export async function addGeneratedAccount(): Promise<AccountRecord> {
  const { generatePrivateKey } = await import('viem/accounts');
  return addLocalPkAccount(generatePrivateKey(), 'generated');
}

export async function importPrivateKey(input: string): Promise<AccountRecord> {
  return addLocalPkAccount(normalizePk(input), 'privateKey');
}

export async function importFromSeed(mnemonic: string): Promise<AccountRecord> {
  return addLocalPkAccount(privateKeyFromMnemonic(mnemonic), 'privateKey');
}

export async function setActiveAccountId(id: string): Promise<void> {
  await store.setActiveAccountId(id);
}

export async function removeAccountRecord(id: string): Promise<AccountRecord[]> {
  const next = await store.removeAccount(id);
  deletePk(id);
  return next;
}
