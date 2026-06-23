
import { ref, type Ref } from 'vue';
import type { Hex } from 'viem';
import type { HDAccount } from 'viem/accounts';
import {
  createAccountStore, type KeyValueStore, type AccountStore,
} from '@stage-labs/client/accounts/store';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import {
  PK_PREFIX, normalizePk, privateKeyFromMnemonic, accountIdFromPk, canExportPrivateKey,
} from '@stage-labs/client/accounts/keys';
import {
  generateWalletMnemonic, normalizeMnemonic, isValidMnemonic, deriveOwner,
} from '@stage-labs/client/zerodev/derive';
import { dbDirFor } from '@stage-labs/client/accounts/registry';

export type { AccountRecord };
export { canExportPrivateKey };

const LEGACY_PK_KEY = 'xmtp.privateKey';
const MNEMONIC_KEY = 'wallet.mnemonic';

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

function readMnemonic(): string | null {
  const raw = localStorage.getItem(MNEMONIC_KEY);
  if (!raw) return null;
  const phrase = normalizeMnemonic(raw);
  return isValidMnemonic(phrase) ? phrase : null;
}

function ensureMnemonic(): string {
  const existing = readMnemonic();
  if (existing) return existing;
  const minted = generateWalletMnemonic();
  localStorage.setItem(MNEMONIC_KEY, minted);
  return minted;
}

const ownerCache = new Map<number, HDAccount>();

export function smartOwnerSigner(hdIndex: number): HDAccount {
  const cached = ownerCache.get(hdIndex);
  if (cached) return cached;
  const mnemonic = readMnemonic();
  if (!mnemonic) throw new Error('Recovery phrase unavailable for this smart account.');
  const owner = deriveOwner(mnemonic, hdIndex);
  ownerCache.set(hdIndex, owner);
  return owner;
}

async function nextSmartHdIndex(): Promise<number> {
  const list = await store.loadAccounts();
  let max = -1;
  for (const a of list) {
    if (a.type === 'smart' && typeof a.hdIndex === 'number' && a.hdIndex > max) max = a.hdIndex;
  }
  return max + 1;
}

async function persistSmartAccount(rec: AccountRecord): Promise<AccountRecord> {
  const id = rec.id.toLowerCase();
  const list = await store.loadAccounts();
  const existing = list.find(a => a.id === id);
  if (existing) {
    Object.assign(existing, rec, { id });
    await store.persist(list);
    await store.setActiveAccountId(id);
    return existing;
  }
  const created: AccountRecord = { ...rec, id };
  await store.persist([...list, created]);
  await store.setActiveAccountId(id);
  return created;
}

async function prepareSmartAccount(): Promise<{ hdIndex: number; owner: HDAccount }> {
  ensureMnemonic();
  const hdIndex = await nextSmartHdIndex();
  const owner = smartOwnerSigner(hdIndex);
  return { hdIndex, owner };
}

function buildSmartAccountRecord(
  address: string,
  hdIndex: number,
  owner: HDAccount,
): AccountRecord {
  const lower = address.toLowerCase();
  return {
    id: lower,
    address,
    type: 'smart',
    dbDir: dbDirFor(lower),
    registered: false,
    createdAt: Date.now(),
    hdIndex,
    ownerAddress: owner.address.toLowerCase(),
    deployed: false,
    scwXmtp: true,
  };
}

const SMART_UNCONFIGURED_MESSAGE =
  'Smart accounts are unavailable — ZeroDev is not configured for this build.';

export function smartAccountsConfigured(): boolean {
  return !!((import.meta.env.VITE_ZERODEV_PROJECT_ID as string | undefined)?.trim())
    || !!((import.meta.env.VITE_ZERODEV_RPC as string | undefined)?.trim());
}

export async function addSmartAccount(): Promise<AccountRecord> {
  if (!smartAccountsConfigured()) throw new Error(SMART_UNCONFIGURED_MESSAGE);
  await ensureMigrated();
  const { hdIndex, owner } = await prepareSmartAccount();
  const { makePublicClient } = await import('./zerodev');
  const { createEcdsaKernel } = await import('@stage-labs/client/zerodev/account');
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, hdIndex);
  const record = buildSmartAccountRecord(account.address, hdIndex, owner);
  return persistSmartAccount(record);
}
