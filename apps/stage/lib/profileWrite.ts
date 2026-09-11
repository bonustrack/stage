import { base } from 'viem/chains';
import { namehash, type Hex } from 'viem';
import { normalize } from 'viem/ens';
import { encodeSetTextRecords, type ContractCall } from '@stage-labs/client/identity/basenameWrite';
import { PROFILE_TEXT_KEYS, makeProfileClients, resolverForNode } from '@stage-labs/client/identity/onchainProfile';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { getActiveAccount } from './accounts';
import { invalidatePeerProfile } from './peerProfiles';
import { uploadAvatar } from './profile';
import { sendCall } from './tx';
import { kernelClientForRecord } from './zerodev/kernelForRecord';

const STAMP_CLEAR_URL = 'https://stamp.fyi/clear/address/';

export interface ProfileChanges {
  displayName?: string;
  description?: string;
  image?: { uri: string; mime: string; name?: string };
}

export async function sendOnBase(call: ContractCall): Promise<Hex> {
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account');
  if (active.type === 'smart') {
    const kernel = await kernelClientForRecord(active);
    return kernel.sendTransaction({ to: call.to, data: call.data, value: 0n } as Parameters<typeof kernel.sendTransaction>[0]);
  }
  return sendCall({ to: call.to, data: call.data, chainId: base.id });
}

export function clearStampLookup(address: string): void {
  fetch(`${STAMP_CLEAR_URL}${address.toLowerCase()}`).catch(() => undefined);
}

async function recordsFor(changes: ProfileChanges): Promise<Record<string, string>> {
  const records: Record<string, string> = {};
  if (changes.displayName !== undefined) records[PROFILE_TEXT_KEYS.displayName] = changes.displayName;
  if (changes.description !== undefined) records[PROFILE_TEXT_KEYS.description] = changes.description;
  if (changes.image) records[PROFILE_TEXT_KEYS.avatar] = await uploadAvatar(changes.image.uri, changes.image.mime, changes.image.name ?? 'avatar');
  return records;
}

export async function saveBasenameProfile(address: string, name: string, changes: ProfileChanges): Promise<Hex | null> {
  const records = await recordsFor(changes);
  if (Object.keys(records).length === 0) return null;
  const resolver = await resolverForNode(makeProfileClients(broviderRpc).base, namehash(normalize(name)));
  const hash = await sendOnBase(encodeSetTextRecords(name, records, resolver ?? undefined));
  invalidatePeerProfile(address);
  clearStampLookup(address);
  return hash;
}
