import { Platform } from 'react-native';
import { base } from 'viem/chains';
import { namehash, type Hex } from 'viem';
import { normalize } from 'viem/ens';
import type { ProfileSetup } from '../components/onboarding/Onboarding.profile.model';
import { PINEAPPLE_UPLOAD_URL, parsePineappleResponse } from '@stage-labs/client/profile/upload';
import { encodeSetPrimaryBasename, encodeSetTextRecords, type ContractCall } from '@stage-labs/client/identity/basenameWrite';
import { PROFILE_TEXT_KEYS, baseProfileClient, resolverForNode } from '@stage-labs/client/identity/onchainProfile';
import { claimMessage, fetchIssuedName, stageNameOf } from '@stage-labs/client/identity/stageNames';
import { getActiveAccount, getActiveViemAccount } from './accounts';
import { linkProxyBase } from './historyServer';
import { invalidatePeerProfile } from './peerProfiles';
import { sendCall } from './tx';
import { kernelClientForRecord } from './zerodev/client';
import { ignore, ignored } from './errorPolicy';

async function filePart(uri: string, mime: string, name: string): Promise<Blob | { uri: string; name: string; type: string }> {
  if (Platform.OS !== 'web') return { uri, name, type: mime };
  const blob = await (await fetch(uri)).blob();
  return new File([blob], name, { type: mime || blob.type });
}

export async function uploadAvatar(uri: string, mime: string, name = 'avatar'): Promise<string> {
  const form = new FormData();
  form.append('file', (await filePart(uri, mime, name)) as Blob);
  const res = await fetch(PINEAPPLE_UPLOAD_URL, { method: 'POST', body: form });
  const json: unknown = await res.json().catch(ignored({}, 'optional'));
  if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
  return parsePineappleResponse(json);
}

const STAMP_CLEAR_URL = 'https://stamp.fyi/clear/';

export interface ProfileChanges {
  displayName?: string;
  description?: string;
  image?: { uri: string; mime: string; name?: string };
  removeImage?: boolean;
}

async function submitOnBase(call: ContractCall): Promise<Hex> {
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account');
  if (active.type === 'smart') {
    const kernel = await kernelClientForRecord(active);
    return kernel.sendTransaction({ to: call.to, data: call.data, value: 0n } as Parameters<typeof kernel.sendTransaction>[0]);
  }
  return sendCall({ to: call.to, data: call.data, chainId: base.id });
}

async function sendOnBase(call: ContractCall): Promise<Hex> {
  const hash = await submitOnBase(call);
  const receipt = await baseProfileClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('The transaction reverted.');
  return hash;
}

function refreshProfileCaches(address: string, avatarChanged = false): void {
  const id = address.toLowerCase();
  ignore(fetch(`${STAMP_CLEAR_URL}address/${id}`), 'cache');
  if (avatarChanged) ignore(fetch(`${STAMP_CLEAR_URL}avatar/eth:${id}`), 'cache');
  invalidatePeerProfile(address);
}

async function recordsFor(changes: ProfileChanges): Promise<Record<string, string>> {
  const records: Record<string, string> = {};
  if (changes.displayName !== undefined) records[PROFILE_TEXT_KEYS.displayName] = changes.displayName;
  if (changes.description !== undefined) records[PROFILE_TEXT_KEYS.description] = changes.description;
  if (changes.image) records[PROFILE_TEXT_KEYS.avatar] = await uploadAvatar(changes.image.uri, changes.image.mime, changes.image.name ?? 'avatar');
  else if (changes.removeImage === true) records[PROFILE_TEXT_KEYS.avatar] = '';
  return records;
}

export async function saveBasenameProfile(address: string, name: string, changes: ProfileChanges): Promise<Hex | null> {
  const records = await recordsFor(changes);
  if (Object.keys(records).length === 0) return null;
  const resolver = await resolverForNode(baseProfileClient(), namehash(normalize(name)));
  const hash = await sendOnBase(encodeSetTextRecords(name, records, resolver ?? undefined));
  refreshProfileCaches(address, changes.image !== undefined || changes.removeImage === true);
  return hash;
}

export interface NameCheck { valid: boolean; available: boolean; reason?: string }

const HEADERS = { 'content-type': 'application/json', 'x-stage-client': '1' };

async function signWithActiveAccount(message: string): Promise<{ address: Hex; signature: Hex }> {
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account');
  if (active.type === 'smart') {
    const kernel = await kernelClientForRecord(active);
    const signature = await kernel.signMessage({ message } as Parameters<typeof kernel.signMessage>[0]);
    return { address: active.address as Hex, signature };
  }
  const local = await getActiveViemAccount();
  if (!local) throw new Error('This account cannot sign messages');
  return { address: local.address, signature: await local.signMessage({ message }) };
}

export async function checkStageName(label: string): Promise<NameCheck> {
  const res = await fetch(`${linkProxyBase()}/names/check?label=${encodeURIComponent(label)}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`name service responded ${res.status}`);
  return (await res.json()) as NameCheck;
}

export function ownedStageName(address: string): Promise<string | null> {
  return fetchIssuedName(linkProxyBase(), address);
}

export async function claimStageName(label: string): Promise<string> {
  const issuedAt = Date.now();
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account');
  const message = claimMessage({ label, address: active.address, issuedAt });
  const { address, signature } = await signWithActiveAccount(message);
  const res = await fetch(`${linkProxyBase()}/names/claim`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ label, address, issuedAt, signature }),
  });
  const body = (await res.json().catch(ignored({}, 'optional'))) as { name?: string; error?: string };
  if (!res.ok || !body.name) throw new Error(body.error ?? `claim failed (${res.status})`);
  return body.name;
}

export async function setPrimaryStageName(address: string, label: string): Promise<Hex> {
  const hash = await sendOnBase(encodeSetPrimaryBasename(stageNameOf(label)));
  refreshProfileCaches(address);
  return hash;
}

export async function applyProfileSetup(address: string, profile: ProfileSetup): Promise<void> {
  await claimStageName(profile.label);
  await setPrimaryStageName(address, profile.label);
  if (profile.displayName === undefined && profile.description === undefined && profile.image === undefined) return;
  await saveBasenameProfile(address, stageNameOf(profile.label), {
    displayName: profile.displayName, description: profile.description, image: profile.image,
  });
}
