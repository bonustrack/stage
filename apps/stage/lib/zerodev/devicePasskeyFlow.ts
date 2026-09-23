import '../cryptoShim';
import type { Hex } from 'viem';
import { devicePasskeyPermissionId, enableDevicePasskeyCalls, removeDevicePasskeyCalls } from '@stage-labs/client/zerodev/devicePasskey';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import type { AccountRecord } from '../accounts';
import { loadAccounts, updateSmartAccount } from '../accounts';
import { makeKernelClient, makePublicClient } from './client';
import { passkeysAvailable, registerPasskeyCredential } from './passkeys';
import type { StoredPasskey } from './passkeys.model';
import { zerodevConfigured, zerodevRpId } from './env';
import { kernelCustody, type KernelCustody } from './linkPasskey';
import { ecdsaRootClient, kernelClientForRecord } from './kernelForRecord';
import { report } from '../errorPolicy';
import { devicePasskeyKey, enablingDevicePasskeyKernel, readDevicePasskeyInstalled, type DevicePasskeyRecord } from './devicePasskey';

export type DevicePasskeyStep<T> = { ok: true; value: T } | { ok: false; message: string; cancelled?: boolean };

const NOT_SMART = 'Not a smart account.';
const CANCELLED = 'Passkey request cancelled.';
const RECEIPT_TIMEOUT_MS = 120_000;
const CONFIRM_READS = 5;
const CONFIRM_READ_GAP_MS = 2_000;

const CUSTODY_BLOCKS: Record<Exclude<KernelCustody, 'undeployed' | 'ecdsa-root'>, string> = {
  'passkey-root': 'This wallet is still secured by a passkey. Make your recovery phrase the main key first, then enable a passkey for this device.',
  'other-root': 'This account is controlled by another signer, so a passkey cannot be added here.',
};

function fail<T>(message: string, cancelled = false): DevicePasskeyStep<T> {
  return cancelled ? { ok: false, message, cancelled } : { ok: false, message };
}

function firstLine(e: unknown, fallback: string): string {
  report('passkey.device', e);
  return txErrorMessage(e, fallback).split('\n')[0] ?? fallback;
}

async function latest(rec: AccountRecord): Promise<AccountRecord> {
  return (await loadAccounts()).find((a) => a.id === rec.id) ?? rec;
}

export async function devicePasskeyInstalled(rec: AccountRecord): Promise<boolean> {
  const stored = (await latest(rec)).devicePasskey;
  if (!stored) return false;
  return readDevicePasskeyInstalled(makePublicClient(), rec.address as Hex, devicePasskeyPermissionId(devicePasskeyKey(stored)));
}

async function preflight(rec: AccountRecord): Promise<string | null> {
  if (rec.type !== 'smart' || rec.hdIndex == null) return NOT_SMART;
  if (!passkeysAvailable()) return 'Passkeys are not available on this device.';
  if (!zerodevConfigured()) return 'Smart wallet is not configured.';
  const custody = await kernelCustody(rec.address as Hex);
  return custody === 'undeployed' || custody === 'ecdsa-root' ? null : CUSTODY_BLOCKS[custody];
}

async function credentialFor(rec: AccountRecord & { hdIndex: number }, reuse?: StoredPasskey): Promise<StoredPasskey | null> {
  if (reuse) return reuse;
  if (rec.devicePasskey) return rec.devicePasskey;
  const label = rec.label?.trim() ? rec.label.trim() : `stage-${rec.hdIndex}`;
  return registerPasskeyCredential(rec.hdIndex, { rpId: zerodevRpId(), userName: label });
}

interface EnablingProgress { submitted: boolean }

async function sendEnablingOperation(rec: AccountRecord & { hdIndex: number }, stored: StoredPasskey, progress: EnablingProgress): Promise<string> {
  const publicClient = makePublicClient();
  const account = await enablingDevicePasskeyKernel(publicClient, { address: rec.address as Hex, hdIndex: rec.hdIndex, phraseId: rec.phraseId }, stored);
  if (account.address.toLowerCase() !== rec.address.toLowerCase()) throw new Error('The recovery phrase does not control this account.');
  const client = makeKernelClient(account, publicClient);
  const hash = await client.sendUserOperation({ calls: enableDevicePasskeyCalls() });
  progress.submitted = true;
  const receipt = await client.waitForUserOperationReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
  if (!receipt.success) throw new Error('Adding the passkey did not go through on-chain.');
  return receipt.receipt.transactionHash;
}

async function installedAfterReceipt(address: Hex, permissionId: Hex): Promise<boolean> {
  const publicClient = makePublicClient();
  for (let read = 0; read < CONFIRM_READS; read += 1) {
    if (await readDevicePasskeyInstalled(publicClient, address, permissionId)) return true;
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_READ_GAP_MS));
  }
  return false;
}

async function installDevicePasskey(rec: AccountRecord & { hdIndex: number }, stored: StoredPasskey): Promise<DevicePasskeyStep<string>> {
  const permissionId = devicePasskeyPermissionId(devicePasskeyKey(stored));
  const address = rec.address as Hex;
  const devicePasskey: DevicePasskeyRecord = { ...stored, permissionId };
  await updateSmartAccount(rec.id, { devicePasskey });
  const progress: EnablingProgress = { submitted: false };
  try {
    if (await readDevicePasskeyInstalled(makePublicClient(), address, permissionId)) return { ok: true, value: '' };
    const txHash = await sendEnablingOperation(rec, stored, progress);
    if (await installedAfterReceipt(address, permissionId)) return { ok: true, value: txHash };
    return fail('The passkey was not installed yet. Check again in a moment.');
  } catch (e) {
    if (!progress.submitted) await updateSmartAccount(rec.id, { devicePasskey: undefined });
    return fail(firstLine(e, 'Could not enable the passkey.'));
  }
}

export async function enableDevicePasskey(record: AccountRecord, reuse?: StoredPasskey): Promise<DevicePasskeyStep<string>> {
  const rec = await latest(record);
  try {
    const blocked = await preflight(rec);
    if (blocked !== null || rec.hdIndex == null) return fail(blocked ?? NOT_SMART);
    const smart = { ...rec, hdIndex: rec.hdIndex };
    const stored = await credentialFor(smart, reuse);
    if (!stored) return fail(CANCELLED, true);
    return await installDevicePasskey(smart, stored);
  } catch (e) {
    return fail(firstLine(e, 'Could not enable the passkey.'));
  }
}

async function removalClient(rec: AccountRecord): Promise<ReturnType<typeof kernelClientForRecord>> {
  const custody = await kernelCustody(rec.address as Hex);
  if (custody === 'ecdsa-root' && rec.hdIndex != null) return ecdsaRootClient({ ...rec, hdIndex: rec.hdIndex });
  return kernelClientForRecord(rec);
}

export async function removeDevicePasskey(record: AccountRecord): Promise<DevicePasskeyStep<string>> {
  const rec = await latest(record);
  const stored = rec.devicePasskey;
  if (!stored) return fail('This device has no passkey of its own.');
  try {
    const publicClient = makePublicClient();
    const address = rec.address as Hex;
    const permissionId = devicePasskeyPermissionId(devicePasskeyKey(stored));
    if (!(await readDevicePasskeyInstalled(publicClient, address, permissionId))) {
      await updateSmartAccount(rec.id, { devicePasskey: undefined });
      return { ok: true, value: '' };
    }
    const kernel = await removalClient(rec);
    const txHash = await kernel.sendTransaction({ calls: removeDevicePasskeyCalls(address, permissionId) });
    await updateSmartAccount(rec.id, { devicePasskey: undefined });
    return { ok: true, value: txHash };
  } catch (e) {
    return fail(firstLine(e, 'Could not remove the passkey.'));
  }
}
