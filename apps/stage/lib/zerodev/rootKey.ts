import '../cryptoShim';
import type { Hex } from 'viem';
import { planRootKeyMigration, rootKeyMigrationCalls, type RootKeyMigration } from '@stage-labs/client/zerodev/rootKey';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import type { AccountRecord } from '../accounts';
import { loadAccounts, updateSmartAccount } from '../accounts';
import { report } from '../errorPolicy';
import { smartOwnerAddress } from './keyring';
import { zerodevConfigured } from './env';
import { kernelCustody } from './linkPasskey';
import { kernelClientForRecord, signingContext } from './kernelForRecord';
import type { StoredPasskey } from './passkeys.model';

export type { RootKeyMigration } from '@stage-labs/client/zerodev/rootKey';

export type RootKeyResult =
  | { ok: true; txHash: string; reusablePasskey: StoredPasskey | null }
  | { ok: false; message: string };

const CONFIRM_READS = 5;
const CONFIRM_READ_GAP_MS = 2_000;
const ELSEWHERE =
  'This device cannot approve the change. Do it once on the device that has your passkey: Settings, Security, Make your recovery phrase the main key.';

async function latest(rec: AccountRecord): Promise<AccountRecord> {
  return (await loadAccounts()).find((a) => a.id === rec.id) ?? rec;
}

export async function rootKeyMigrationFor(rec: AccountRecord): Promise<RootKeyMigration> {
  if (rec.type !== 'smart' || rec.hdIndex == null) return 'not-needed';
  const custody = await kernelCustody(rec.address as Hex);
  if (custody !== 'passkey-root') return 'not-needed';
  const { input } = await signingContext(rec, 'transact');
  return planRootKeyMigration({ ...input, passkeyRoot: true });
}

async function ecdsaRootConfirmed(address: Hex): Promise<boolean> {
  for (let read = 0; read < CONFIRM_READS; read += 1) {
    if ((await kernelCustody(address)) === 'ecdsa-root') return true;
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_READ_GAP_MS));
  }
  return false;
}

async function sendMigration(rec: AccountRecord & { hdIndex: number }): Promise<string> {
  const { publicClient, input } = await signingContext(rec, 'transact');
  if (input.rootValidatorId === null) throw new Error('This account is not deployed yet.');
  const owner = (await smartOwnerAddress({ hdIndex: rec.hdIndex, phraseId: rec.phraseId })) as Hex;
  const calls = rootKeyMigrationCalls(rec.address as Hex, input.ecdsaValidator, owner, input.rootValidatorId);
  const kernel = await kernelClientForRecord(rec, 'transact');
  const txHash = await kernel.sendTransaction({ calls });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

function preflight(rec: AccountRecord): string | null {
  if (rec.type !== 'smart' || rec.hdIndex == null) return 'Not a smart account.';
  return zerodevConfigured() ? null : 'Smart wallet is not configured.';
}

function failureMessage(e: unknown): string {
  report('rootkey.migrate', e);
  const fallback = 'Could not change the main key.';
  return txErrorMessage(e, fallback).split('\n')[0] ?? fallback;
}

async function migrate(rec: AccountRecord & { hdIndex: number }): Promise<RootKeyResult> {
  const migration = await rootKeyMigrationFor(rec);
  if (migration === 'not-needed') return { ok: false, message: 'Your recovery phrase is already the main key.' };
  if (migration === 'elsewhere') return { ok: false, message: ELSEWHERE };
  const txHash = await sendMigration(rec);
  if (!(await ecdsaRootConfirmed(rec.address as Hex))) return { ok: false, message: 'The change did not go through on-chain. Try again.' };
  await updateSmartAccount(rec.id, { passkey: undefined, passkeyCredId: undefined, passkeySudo: undefined });
  return { ok: true, txHash, reusablePasskey: migration === 'passkey' && rec.passkey ? rec.passkey : null };
}

export async function makePhraseRootKey(record: AccountRecord): Promise<RootKeyResult> {
  const rec = await latest(record);
  const blocked = preflight(rec);
  if (blocked !== null || rec.hdIndex == null) return { ok: false, message: blocked ?? 'Not a smart account.' };
  try {
    return await migrate({ ...rec, hdIndex: rec.hdIndex });
  } catch (e) {
    return { ok: false, message: failureMessage(e) };
  }
}
