import {
  type ProfileImage,
  type ProfileProgress,
  type ProfileSetup,
  ProfileNameTakenError,
  runProfileSetup,
} from '@stage-labs/client/profile/setup';
import { namehash, type Hex } from 'viem';
import { normalize } from 'viem/ens';
import { PINEAPPLE_UPLOAD_URL, parsePineappleResponse } from '@stage-labs/client/profile/upload';
import { encodeNameSetup, encodeSetTextRecords, type ContractCall } from '@stage-labs/client/identity/basenameWrite';
import {
  BASENAME_REGISTRY,
  REGISTRY_ABI,
  PROFILE_TEXT_KEYS,
  baseProfileClient,
  inspectNameSetup,
} from '@stage-labs/client/identity/onchainProfile';
import { claimMessage, stageNameOf } from '@stage-labs/client/identity/stageNames';
import {
  fetchIssuedName,
  fetchNameCheck,
  postNameClaim,
  type NameCheck,
  type NameClaimOutcome,
} from '@stage-labs/client/identity/namesApi';
import { getSelectedAccount } from './accounts';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { selectionScope } from './accountSelection';
import { linkProxyBase } from './linkProxy';
import { invalidatePeerProfile } from './peerProfiles';
import { sendCallsFrom, signFrom } from './tx';
import { ignore, recover, reported } from './errorPolicy';
import { claimMailKey, registerOwnMailKey } from './mailKey';
import { profileRequest } from './profileFetch';
import { avatarFilePart } from './avatarFile';

interface ProfileAccount {
  record: AccountRecord;
  assertCurrent: () => void;
}

async function profileAccount(address?: string): Promise<ProfileAccount> {
  const scope = selectionScope();
  const record = await getSelectedAccount();
  const assertCurrent = (): void => {
    scope.assertCurrent('The account changed while saving your profile.');
  };
  assertCurrent();
  if (record === null || (address !== undefined && record.address.toLowerCase() !== address.toLowerCase())) {
    throw new Error('Select the account whose profile you want to save.');
  }
  return { record, assertCurrent };
}

export async function uploadAvatar(uri: string, mime: string, name = 'avatar'): Promise<string> {
  const form = new FormData();
  form.append('file', (await avatarFilePart(uri, mime, name)) as Blob);
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

async function succeededOnBase(hash: Hex): Promise<boolean> {
  return (await baseProfileClient().waitForTransactionReceipt({ hash })).status === 'success';
}

async function confirmedOnBase(hash: Hex): Promise<Hex> {
  if (!(await succeededOnBase(hash))) throw new Error('The transaction reverted.');
  return hash;
}

const NO_PROFILE_KEY = 'This account cannot save a profile.';

async function sendOnBase(account: ProfileAccount, calls: ContractCall[]): Promise<Hex> {
  const sent = await sendCallsFrom(account.record, calls, {
    missingKey: NO_PROFILE_KEY,
    before: account.assertCurrent,
    confirm: confirmedOnBase,
  });
  account.assertCurrent();
  return sent.hash;
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
  if (changes.image) records[PROFILE_TEXT_KEYS.avatar] = await uploadAvatar(changes.image.uri, changes.image.mime, changes.image.name);
  else if (changes.removeImage === true) records[PROFILE_TEXT_KEYS.avatar] = '';
  return records;
}

async function nameResolver(name: string): Promise<Hex> {
  const resolver = await baseProfileClient().readContract({
    address: BASENAME_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'resolver',
    args: [namehash(normalize(name))],
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

async function signForAccount(account: ProfileAccount, message: string): Promise<Hex> {
  const signed = await signFrom(
    account.record,
    { message },
    { missingKey: 'This account cannot sign messages', before: account.assertCurrent },
  );
  return signed.signature;
}

export function checkStageName(label: string): Promise<NameCheck> {
  return fetchNameCheck(linkProxyBase(), label, profileRequest);
}

export function ownedStageName(address: string): Promise<string | null> {
  return fetchIssuedName(linkProxyBase(), address);
}

function claimedName(outcome: NameClaimOutcome): string {
  switch (outcome.kind) {
    case 'claimed':
      return outcome.name;
    case 'taken':
      throw new ProfileNameTakenError();
    case 'refused':
      throw new Error(outcome.error ?? `claim failed (${outcome.status})`);
    case 'unconfirmed':
      throw new Error('The name service did not confirm your username.');
  }
}

async function claimForAccount(account: ProfileAccount, label: string): Promise<string> {
  const { record, assertCurrent } = account;
  const mailKey = await claimMailKey(record, label).catch(recover('mail.claimKey', undefined));
  assertCurrent();
  const address = record.address;
  const issuedAt = Date.now();
  const signature = await signForAccount(account, claimMessage({ label, address, issuedAt, mailKey }));
  assertCurrent();
  const outcome = await postNameClaim(linkProxyBase(), { label, address, issuedAt, signature, mailKey }, profileRequest);
  const name = claimedName(outcome);
  if (outcome.kind === 'claimed' && outcome.mailKeyFailed) void registerOwnMailKey(record, label).catch(reported('mail.key'));
  assertCurrent();
  return name;
}

async function nameSetupCalls(address: string, label: string, records: Record<string, string>): Promise<ContractCall[]> {
  const name = stageNameOf(label);
  return encodeNameSetup(name, address as Hex, records, await nameResolver(name));
}

export async function setUpStageName(address: string, label: string, records: Record<string, string> = {}): Promise<Hex> {
  const account = await profileAccount(address);
  const hash = await sendOnBase(account, await nameSetupCalls(address, label, records));
  refreshProfileCaches(address, records[PROFILE_TEXT_KEYS.avatar] !== undefined);
  return hash;
}

export async function claimAndSetUpStageName(address: string, label: string): Promise<Hex> {
  await claimForAccount(await profileAccount(), label);
  return setUpStageName(address, label);
}

export async function applyProfileSetup(
  address: string,
  profile: ProfileSetup,
  progress: ProfileProgress,
  checkpoint: (next: ProfileProgress) => Promise<void>,
): Promise<void> {
  const account = await profileAccount(address);
  await runProfileSetup(
    {
      assertCurrent: account.assertCurrent,
      upload: (image) => uploadAvatar(image.uri, image.mime, image.name),
      inspect: (label, records) => inspectNameSetup(baseProfileClient(), address, stageNameOf(label), records),
      claim: (label) => claimForAccount(account, label),
      send: async (label, records) => {
        if (account.record.type !== 'smart') throw new Error('The prepared account is not a smart wallet.');
        const calls = await nameSetupCalls(address, label, records);
        return (await sendCallsFrom(account.record, calls, { missingKey: NO_PROFILE_KEY, before: account.assertCurrent })).hash;
      },
      confirm: succeededOnBase,
    },
    profile,
    progress,
    checkpoint,
  );
  account.assertCurrent();
  refreshProfileCaches(address, profile.image !== undefined);
}
