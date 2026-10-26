import '../cryptoShim';
import type { PublicClient } from 'viem';
import { addSmartAccount, loadAccounts, loadAccountsForWrite, nextSmartHdIndex, setActiveAccountId, type AccountRecord } from '../accounts';
import { isXmtpRegistered } from '../xmtp.client';
import { ensurePrimaryPhrase, smartOwnerSigner } from './keyring';
import { reserveSmartHdIndex } from './hdIndexStore';
import { createEcdsaKernel } from '@stage-labs/client/zerodev/account';
import { makePublicClient, zerodevConfigured } from './client';
import { samePreparedAccount } from '@stage-labs/client/profile/setup';

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

async function storeSmartAccount(
  phraseId: string, candidate: Candidate, onPrepared?: (account: AccountRecord) => Promise<void>,
): Promise<AccountRecord> {
  const { hdIndex, owner, address } = candidate;
  const rec: AccountRecord = {
    id: address.toLowerCase(),
    address,
    type: 'smart',
    dbDir: `xmtp-${address.toLowerCase()}`,
    registered: false,
    createdAt: Date.now(),
    hdIndex,
    phraseId,
    ownerAddress: owner.address.toLowerCase(),
  };
  await onPrepared?.(rec);
  await reserveSmartHdIndex(phraseId, hdIndex);
  return addSmartAccount(rec);
}

export async function createSmartAccount(onPrepared?: (account: AccountRecord) => Promise<void>): Promise<AccountRecord> {
  requireConfigured();
  const phraseId = await ensurePrimaryPhrase();
  return storeSmartAccount(phraseId, await pickFreshAccount(makePublicClient(), phraseId), onPrepared);
}

function matchesCandidate(rec: AccountRecord, candidate: Candidate): boolean {
  return candidate.address.toLowerCase() === rec.id && candidate.address.toLowerCase() === rec.address.toLowerCase()
    && candidate.owner.address.toLowerCase() === rec.ownerAddress?.toLowerCase() && rec.dbDir === `xmtp-${rec.id}`;
}

export async function resumeSmartAccount(rec: AccountRecord): Promise<AccountRecord> {
  requireConfigured();
  if (rec.type !== 'smart' || rec.phraseId === undefined || rec.hdIndex === undefined) throw new Error('The prepared wallet is incomplete.');
  const candidate = await candidateAt(makePublicClient(), rec.phraseId, rec.hdIndex);
  if (!matchesCandidate(rec, candidate)) {
    throw new Error('The prepared wallet does not match its recovery phrase. Nothing was changed.');
  }
  const existing = (await loadAccountsForWrite()).find(account => account.id === rec.id);
  if (existing !== undefined && !samePreparedAccount(existing, rec)) {
    throw new Error('The saved wallet does not match the prepared account. Nothing was changed.');
  }
  await reserveSmartHdIndex(rec.phraseId, rec.hdIndex);
  if (existing !== undefined) {
    await setActiveAccountId(existing.id);
    return existing;
  }
  return addSmartAccount(rec);
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
