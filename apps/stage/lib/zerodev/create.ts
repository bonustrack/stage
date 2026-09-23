

import '../cryptoShim';
import type { PublicClient } from 'viem';
import { addSmartAccount, loadAccounts, nextSmartHdIndex, setActiveAccountId, type AccountRecord } from '../accounts';
import { isXmtpRegistered } from '../xmtp.registered';
import { ensurePrimaryPhrase, smartOwnerSigner } from './keyring';
import { reserveSmartHdIndex } from './hdIndexStore';
import { makePublicClient } from './client';
import { createEcdsaKernel } from './account';
import { zerodevConfigured } from './env';

export interface CreateSmartAccountOpts {
  label?: string;
  phraseId?: string;
}

export interface RestoredSmartAccount { record: AccountRecord; alreadyImported: boolean }

const FRESH_SEARCH_LIMIT = 32;

async function identityInUse(publicClient: PublicClient, address: `0x${string}`): Promise<boolean> {
  const [code, registered] = await Promise.all([
    publicClient.getCode({ address }),
    isXmtpRegistered(address),
  ]);
  return (code !== undefined && code !== '0x') || registered;
}

interface Candidate { hdIndex: number; owner: Awaited<ReturnType<typeof smartOwnerSigner>>; address: `0x${string}` }

async function candidateAt(publicClient: PublicClient, phraseId: string, hdIndex: number): Promise<Candidate> {
  const owner = await smartOwnerSigner({ phraseId, hdIndex });
  const { address } = await createEcdsaKernel(publicClient, owner, hdIndex);
  return { hdIndex, owner, address };
}

async function pickFreshAccount(publicClient: PublicClient, phraseId: string): Promise<Candidate> {
  const first = await nextSmartHdIndex(phraseId);
  for (let hdIndex = first; hdIndex < first + FRESH_SEARCH_LIMIT; hdIndex++) {
    const candidate = await candidateAt(publicClient, phraseId, hdIndex);
    if (!(await identityInUse(publicClient, candidate.address))) return candidate;
  }
  throw new Error('Could not find an unused wallet for this recovery phrase.');
}

function requireConfigured(): void {
  if (!zerodevConfigured()) throw new Error('Smart wallet is not configured (missing ZeroDev project).');
}

async function storeSmartAccount(phraseId: string, candidate: Candidate, label?: string): Promise<AccountRecord> {
  const { hdIndex, owner, address } = candidate;
  await reserveSmartHdIndex(phraseId, hdIndex);
  const rec: AccountRecord = {
    id: address.toLowerCase(),
    address,
    type: 'smart',
    label,
    dbDir: `xmtp-${address.toLowerCase()}`,
    registered: false,
    createdAt: Date.now(),
    hdIndex,
    phraseId,
    ownerAddress: owner.address.toLowerCase(),
    deployed: false,
    scwXmtp: true,
  };
  return addSmartAccount(rec);
}

export async function createSmartAccount(opts: CreateSmartAccountOpts = {}): Promise<AccountRecord> {
  requireConfigured();
  const phraseId = opts.phraseId ?? await ensurePrimaryPhrase();
  return storeSmartAccount(phraseId, await pickFreshAccount(makePublicClient(), phraseId), opts.label);
}

type Restorable = { kind: 'local'; record: AccountRecord } | { kind: 'candidate'; candidate: Candidate };

async function findRestorable(publicClient: PublicClient, phraseId: string): Promise<Restorable> {
  const local = new Map((await loadAccounts()).map((a) => [a.address.toLowerCase(), a]));
  let alreadyHere: AccountRecord | null = null;
  for (let hdIndex = 0; hdIndex < FRESH_SEARCH_LIMIT; hdIndex++) {
    const candidate = await candidateAt(publicClient, phraseId, hdIndex);
    const existing = local.get(candidate.address.toLowerCase());
    if (existing) { alreadyHere ??= existing; continue; }
    if (await identityInUse(publicClient, candidate.address)) return { kind: 'candidate', candidate };
    if (alreadyHere) break;
    return { kind: 'candidate', candidate };
  }
  if (!alreadyHere) throw new Error('Could not find a wallet for this recovery phrase.');
  return { kind: 'local', record: alreadyHere };
}

export async function restoreSmartAccount(phraseId: string): Promise<RestoredSmartAccount> {
  requireConfigured();
  const found = await findRestorable(makePublicClient(), phraseId);
  if (found.kind === 'candidate') {
    return { record: await storeSmartAccount(phraseId, found.candidate), alreadyImported: false };
  }
  await setActiveAccountId(found.record.id);
  return { record: found.record, alreadyImported: true };
}
