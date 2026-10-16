import { Platform } from 'react-native';
import { parseNameCheck, parseNameClaim, type NameCheck } from '@stage-labs/client/profile/setup';
import { base } from 'viem/chains';
import { createWalletClient, namehash, type Hex } from 'viem';
import { normalize } from 'viem/ens';
import type { ProfileImage, ProfileProgress, ProfileSetup } from '@stage-labs/client/profile/setup';
import { PINEAPPLE_UPLOAD_URL, parsePineappleResponse } from '@stage-labs/client/profile/upload';
import { encodeNameSetup, encodeSetTextRecords, type ContractCall } from '@stage-labs/client/identity/basenameWrite';
import { BASENAME_REGISTRY, REGISTRY_ABI, PROFILE_TEXT_KEYS, baseProfileClient, inspectNameSetup } from '@stage-labs/client/identity/onchainProfile';
import { claimMessage, fetchIssuedName, stageNameOf } from '@stage-labs/client/identity/stageNames';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { getSelectedAccount, getViemAccount, type AccountRecord } from './accounts';
import { getAccountSelection } from './accountSelection';
import { linkProxyBase } from './linkProxy';
import { invalidatePeerProfile } from './peerProfiles';
import { kernelClientForRecord } from './zerodev/client';
import { ignore, recover, reported } from './errorPolicy';
import { claimMailKey, registerOwnMailKey } from './mailKey';
import { profileRequest } from './profileFetch';
import { ProfileNameTakenError, runProfileSetup } from './profileSetup.core';

interface ProfileAccount { record: AccountRecord; assertCurrent: () => void }

async function profileAccount(address?: string): Promise<ProfileAccount> {
  const selected = getAccountSelection();
  const record = await getSelectedAccount();
  const assertCurrent = (): void => {
    if (selected !== getAccountSelection()) throw new Error('The account changed while saving your profile.');
  };
  assertCurrent();
  if (record === null || (address !== undefined && record.address.toLowerCase() !== address.toLowerCase())) {
    throw new Error('Select the account whose profile you want to save.');
  }
  return { record, assertCurrent };
}

async function filePart(uri: string, mime: string, name: string): Promise<Blob | { uri: string; name: string; type: string }> {
  if (Platform.OS !== 'web') return { uri, name, type: mime };
  const blob = await profileRequest(uri, {}, async (response) => {
    if (!response.ok) throw new Error('The selected picture could not be read. Choose it again.');
    return response.blob();
  });
  if (blob.size === 0 || !(mime || blob.type).startsWith('image/')) throw new Error('Choose a valid image for your profile picture.');
  return new File([blob], name, { type: mime || blob.type });
}

export async function uploadAvatar(uri: string, mime: string, name = 'avatar'): Promise<string> {
  const form = new FormData();
  form.append('file', (await filePart(uri, mime, name)) as Blob);
  return profileRequest(PINEAPPLE_UPLOAD_URL, { method: 'POST', body: form }, async (res) => {
    if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
    return parsePineappleResponse(await res.json());
  });
}

const STAMP_CLEAR_URL = 'https://stamp.fyi/clear/';

export interface ProfileChanges {
  displayName?: string;
  description?: string;
  image?: ProfileImage;
  removeImage?: boolean;
}

async function confirmedOnBase(hash: Hex): Promise<Hex> {
  const receipt = await baseProfileClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('The transaction reverted.');
  return hash;
}

async function sendOnBase(account: ProfileAccount, calls: ContractCall[]): Promise<Hex> {
  const { record, assertCurrent } = account;
  if (record.type === 'smart') {
    const kernel = await kernelClientForRecord(record);
    const batch = calls.map((call) => ({ to: call.to, data: call.data, value: 0n }));
    assertCurrent();
    const hash = await confirmedOnBase(await kernel.sendTransaction({ calls: batch }));
    assertCurrent();
    return hash;
  }
  const local = await getViemAccount(record.id);
  if (!local) throw new Error('This account cannot save a profile.');
  const wallet = createWalletClient({ account: local, chain: base, transport: broviderTransport(base.id) });
  let hash: Hex = '0x';
  for (const call of calls) {
    assertCurrent();
    hash = await confirmedOnBase(await wallet.sendTransaction({ to: call.to, data: call.data }));
  }
  assertCurrent();
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

async function nameResolver(name: string): Promise<Hex> {
  const resolver = await baseProfileClient().readContract({
    address: BASENAME_REGISTRY, abi: REGISTRY_ABI, functionName: 'resolver', args: [namehash(normalize(name))],
  });
  if (resolver === '0x0000000000000000000000000000000000000000') throw new Error('The name has no resolver yet. Try again to check it.');
  return resolver;
}

export async function saveBasenameProfile(address: string, name: string, changes: ProfileChanges): Promise<Hex | null> {
  const account = await profileAccount(address);
  const records = await recordsFor(changes);
  if (Object.keys(records).length === 0) return null;
  const resolver = await nameResolver(name);
  account.assertCurrent();
  const hash = await sendOnBase(account, [encodeSetTextRecords(name, records, resolver)]);
  refreshProfileCaches(address, changes.image !== undefined || changes.removeImage === true);
  return hash;
}

export type { NameCheck } from '@stage-labs/client/profile/setup';

const HEADERS = { 'content-type': 'application/json', 'x-stage-client': '1' };

async function signForAccount(account: ProfileAccount, message: string): Promise<Hex> {
  const { record, assertCurrent } = account;
  if (record.type === 'smart') {
    const kernel = await kernelClientForRecord(record);
    assertCurrent();
    return kernel.signMessage({ message } as Parameters<typeof kernel.signMessage>[0]);
  }
  const local = await getViemAccount(record.id);
  if (!local) throw new Error('This account cannot sign messages');
  assertCurrent();
  return local.signMessage({ message });
}

export function checkStageName(label: string): Promise<NameCheck> {
  return profileRequest(`${linkProxyBase()}/names/check?label=${encodeURIComponent(label)}`, { headers: HEADERS }, async (res) => {
    if (!res.ok) throw new Error(`name service responded ${res.status}`);
    return parseNameCheck(await res.json());
  });
}

export function ownedStageName(address: string): Promise<string | null> {
  return fetchIssuedName(linkProxyBase(), address);
}

async function claimForAccount(account: ProfileAccount, label: string): Promise<string> {
  const { record, assertCurrent } = account;
  const mailKey = await claimMailKey(record, label).catch(recover('mail.claimKey', undefined));
  assertCurrent();
  const address = record.address;
  const issuedAt = Date.now();
  const signature = await signForAccount(account, claimMessage({ label, address, issuedAt, mailKey }));
  assertCurrent();
  const name = await profileRequest(`${linkProxyBase()}/names/claim`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ label, address, issuedAt, signature, mailKey }),
  }, async (res) => {
    const body = parseNameClaim(await res.json());
    if (res.status === 409 && body.error === 'name already taken') throw new ProfileNameTakenError();
    if (!res.ok) throw new Error(body.error ?? `claim failed (${res.status})`);
    if (body.name !== stageNameOf(label)) throw new Error('The name service did not confirm your username.');
    if (body.mailKey === 'failed') void registerOwnMailKey(record, label).catch(reported('mail.key'));
    return body.name;
  });
  assertCurrent();
  return name;
}

export async function claimStageName(label: string): Promise<string> {
  return claimForAccount(await profileAccount(), label);
}

export async function setUpStageName(address: string, label: string, records: Record<string, string> = {}): Promise<Hex> {
  const account = await profileAccount(address);
  const name = stageNameOf(label);
  const calls = encodeNameSetup(name, address as Hex, records, await nameResolver(name));
  const hash = await sendOnBase(account, calls);
  refreshProfileCaches(address, records[PROFILE_TEXT_KEYS.avatar] !== undefined);
  return hash;
}

export async function applyProfileSetup(
  address: string, profile: ProfileSetup, progress: ProfileProgress, checkpoint: (next: ProfileProgress) => Promise<void>,
): Promise<void> {
  const account = await profileAccount(address);
  await runProfileSetup({
    assertCurrent: account.assertCurrent,
    upload: (image) => uploadAvatar(image.uri, image.mime, image.name ?? 'avatar'),
    inspect: (label, records) => inspectNameSetup(baseProfileClient(), address, stageNameOf(label), records),
    claim: (label) => claimForAccount(account, label),
    send: async (label, records) => {
      if (account.record.type !== 'smart') throw new Error('The prepared account is not a smart wallet.');
      const name = stageNameOf(label);
      const calls = encodeNameSetup(name, address as Hex, records, await nameResolver(name));
      const kernel = await kernelClientForRecord(account.record);
      account.assertCurrent();
      return kernel.sendTransaction({ calls: calls.map(call => ({ ...call, value: 0n })) });
    },
    confirm: async (hash) => (await baseProfileClient().waitForTransactionReceipt({ hash })).status === 'success',
  }, profile, progress, checkpoint);
  account.assertCurrent();
  refreshProfileCaches(address, profile.image !== undefined);
}
