import '../cryptoShim';
import type { Hex } from 'viem';
import { createKernelAccount } from '@zerodev/sdk';
import { ENTRY_POINT, KERNEL_VERSION } from '@stage-labs/client/zerodev/account';
import {
  checkDevicePasskeyApproval, devicePasskeyFingerprint, devicePasskeyPermissionId, encodeDevicePasskeyApproval,
  encodeDevicePasskeyRequest, enableDevicePasskeyCalls, parseDevicePasskeyApproval, parseDevicePasskeyRequest, removeDevicePasskeyCalls,
  type ApprovalCheck, type DevicePasskeyRequest,
} from '@stage-labs/client/zerodev/devicePasskey';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import type { AccountRecord } from '../accounts';
import { loadAccounts, updateSmartAccount } from '../accounts';
import { makeKernelClient, makePublicClient } from './client';
import { passkeyValidatorFromStored } from './account';
import { passkeysAvailable, registerPasskeyCredential } from './passkeys';
import { zerodevConfigured, zerodevRpId } from './env';
import { accountPasskey, kernelCustody, storedPasskeyMatches } from './linkPasskey';
import { kernelClientForRecord } from './kernelForRecord';
import { report } from '../errorPolicy';
import {
  devicePasskeyKernel, devicePasskeyKey, devicePasskeyValidator, readCurrentNonce, readDevicePasskeyInstalled,
  type DevicePasskeyRecord,
} from './devicePasskey';

export type DevicePasskeyStep<T> = { ok: true; value: T } | { ok: false; message: string };

const NOT_SMART = 'Not a smart account.';
const NOT_PASSKEY_ROOT = 'This account is not secured by a passkey, so it does not need one per device.';
const RECEIPT_TIMEOUT_MS = 120_000;
const CONFIRM_READS = 5;
const CONFIRM_READ_GAP_MS = 2_000;

function fail<T>(message: string): DevicePasskeyStep<T> {
  return { ok: false, message };
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

function devicePasskeyRequestCode(rec: AccountRecord): string | null {
  if (!rec.devicePasskey) return null;
  return encodeDevicePasskeyRequest({ account: rec.address as Hex, key: devicePasskeyKey(rec.devicePasskey) });
}

export function requestCodeFingerprint(code: string): string | null {
  const request = parseDevicePasskeyRequest(code);
  return request === null ? null : devicePasskeyFingerprint(request.key);
}

async function preflight(rec: AccountRecord): Promise<string | null> {
  if (rec.type !== 'smart' || rec.hdIndex == null) return NOT_SMART;
  if (!passkeysAvailable()) return 'Passkeys are not available on this device.';
  if (!zerodevConfigured()) return 'Smart wallet is not configured.';
  return (await kernelCustody(rec.address as Hex)) === 'passkey-root' ? null : NOT_PASSKEY_ROOT;
}

export async function createDevicePasskey(record: AccountRecord): Promise<DevicePasskeyStep<string>> {
  const rec = await latest(record);
  const existing = devicePasskeyRequestCode(rec);
  if (existing !== null) return { ok: true, value: existing };
  try {
    const blocked = await preflight(rec);
    if (blocked !== null) return fail(blocked);
    const label = rec.label?.trim() ? rec.label.trim() : `stage-${rec.hdIndex ?? 0}`;
    const stored = await registerPasskeyCredential(rec.hdIndex ?? 0, { rpId: zerodevRpId(), userName: `${label} device` });
    if (!stored) return fail('Passkey request cancelled.');
    const devicePasskey = { ...stored, permissionId: devicePasskeyPermissionId(devicePasskeyKey(stored)) };
    await updateSmartAccount(rec.id, { devicePasskey });
    return { ok: true, value: encodeDevicePasskeyRequest({ account: rec.address as Hex, key: devicePasskeyKey(stored) }) };
  } catch (e) {
    return fail(firstLine(e, 'Could not create a passkey on this device.'));
  }
}

export function readApprovalRequest(rec: AccountRecord, code: string): DevicePasskeyStep<DevicePasskeyRequest & { fingerprint: string }> {
  const request = parseDevicePasskeyRequest(code);
  if (request === null) return fail('This is not a passkey request code from Stage.');
  if (request.account.toLowerCase() !== rec.address.toLowerCase()) return fail('This request is for a different account.');
  return { ok: true, value: { ...request, fingerprint: devicePasskeyFingerprint(request.key) } };
}

async function rootPasskeyHere(rec: AccountRecord): Promise<string | null> {
  const blocked = await preflight(rec);
  if (blocked !== null) return blocked;
  if (!rec.passkey || !storedPasskeyMatches(rec, await accountPasskey(rec.address as Hex))) {
    return 'Only the device holding the account passkey can approve another device.';
  }
  return null;
}

export async function approveDevicePasskey(record: AccountRecord, request: DevicePasskeyRequest): Promise<DevicePasskeyStep<string>> {
  try {
    const rec = await latest(record);
    const blocked = await rootPasskeyHere(rec);
    if (blocked !== null || !rec.passkey) return fail(blocked ?? NOT_SMART);
    const publicClient = makePublicClient();
    const address = rec.address as Hex;
    const permissionId = devicePasskeyPermissionId(request.key);
    if (await readDevicePasskeyInstalled(publicClient, address, permissionId)) return fail('This passkey is already approved.');
    const sudo = await passkeyValidatorFromStored(publicClient, rec.passkey);
    if (!sudo) return fail('Passkeys are not available on this device.');
    const regular = await devicePasskeyValidator(publicClient, { ...request.key, authenticatorId: '', rpID: zerodevRpId() });
    const account = await createKernelAccount(publicClient, {
      plugins: { sudo, regular }, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_VERSION, address,
    });
    const nonce = Math.max(await readCurrentNonce(publicClient, address), 1);
    const enableSignature = await account.kernelPluginManager.getPluginEnableSignature(address);
    return { ok: true, value: encodeDevicePasskeyApproval({ account: address, permissionId, nonce, enableSignature }) };
  } catch (e) {
    return fail(firstLine(e, 'Could not approve the passkey.'));
  }
}

const APPROVAL_PROBLEMS: Record<Exclude<ApprovalCheck, 'ok'>, string> = {
  'other-account': 'This approval is for a different account.',
  'other-passkey': 'This approval is for a different passkey. Show the request from this device again.',
  stale: 'This approval has expired because the account changed since. Ask your other device to approve again.',
};

async function sendEnablingOperation(rec: AccountRecord & { devicePasskey: DevicePasskeyRecord }, enableSignature: Hex): Promise<string> {
  const publicClient = makePublicClient();
  const account = await devicePasskeyKernel(publicClient, rec.address as Hex, rec.devicePasskey, enableSignature);
  const client = makeKernelClient(account, publicClient);
  const hash = await client.sendUserOperation({ calls: enableDevicePasskeyCalls() });
  const receipt = await client.waitForUserOperationReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
  if (!receipt.success) throw new Error('The approval did not go through on-chain.');
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

export async function completeDevicePasskey(record: AccountRecord, code: string): Promise<DevicePasskeyStep<string>> {
  const rec = await latest(record);
  const stored = rec.devicePasskey;
  if (!stored) return fail('Create a passkey for this device first.');
  const approval = parseDevicePasskeyApproval(code);
  if (approval === null) return fail('This is not an approval code from Stage.');
  try {
    const publicClient = makePublicClient();
    const address = rec.address as Hex;
    const key = devicePasskeyKey(stored);
    if (await readDevicePasskeyInstalled(publicClient, address, devicePasskeyPermissionId(key))) return { ok: true, value: '' };
    const check = checkDevicePasskeyApproval(approval, address, key, await readCurrentNonce(publicClient, address));
    if (check !== 'ok') return fail(APPROVAL_PROBLEMS[check]);
    const txHash = await sendEnablingOperation({ ...rec, devicePasskey: stored }, approval.enableSignature);
    const installed = await installedAfterReceipt(address, devicePasskeyPermissionId(key));
    return installed ? { ok: true, value: txHash } : fail('The passkey was not installed. Try again.');
  } catch (e) {
    return fail(firstLine(e, 'Could not finish adding the passkey.'));
  }
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
    const kernel = await kernelClientForRecord(rec);
    const txHash = await kernel.sendTransaction({ calls: removeDevicePasskeyCalls(address, permissionId) });
    await updateSmartAccount(rec.id, { devicePasskey: undefined });
    return { ok: true, value: txHash };
  } catch (e) {
    return fail(firstLine(e, 'Could not remove the passkey.'));
  }
}
