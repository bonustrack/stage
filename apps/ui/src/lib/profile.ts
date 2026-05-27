/** Snapshot profile read/write on web. Reuses the local viem account minted
 *  for the XMTP signer (see `./xmtp.ts`'s `loadOrCreateAccount`). Same wire
 *  format as the mobile counterpart in `apps/app/lib/profile.ts`. */

import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import {
  SNAPSHOT_DOMAIN, UPDATE_USER_TYPES, PINEAPPLE_UPLOAD_URL,
  buildUpdateUserMessage, postSignedEnvelope, fetchSnapshotProfile,
  type SnapshotProfile,
} from '@metro-labs/client/profile/snapshot';

/** Mirrors `xmtp.ts`'s storage key. Read-only here — the XMTP boot creates it
 *  first; if it's missing we throw rather than silently mint a divergent EOA. */
const PRIVATE_KEY_KEY = 'xmtp.privateKey';
const PROFILE_CACHE_KEY = 'profile.cache';

function loadAccount(): PrivateKeyAccount {
  const stored = localStorage.getItem(PRIVATE_KEY_KEY);
  if (!stored || !/^0x[0-9a-fA-F]{64}$/.test(stored)) {
    throw new Error('No local wallet — open the Channels tab first to bootstrap XMTP.');
  }
  return privateKeyToAccount(stored as Hex);
}

export function loadCachedProfile(): SnapshotProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) as SnapshotProfile : null;
  } catch { return null; }
}

function storeCachedProfile(profile: SnapshotProfile): void {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)); }
  catch { /* quota — ignore */ }
}

export async function readProfile(address: string): Promise<SnapshotProfile | null> {
  const remote = await fetchSnapshotProfile(address);
  if (remote) { storeCachedProfile(remote); return remote; }
  return loadCachedProfile();
}

export async function updateProfile(profile: SnapshotProfile): Promise<unknown> {
  const account = loadAccount();
  const message = buildUpdateUserMessage(account.address, profile);
  /** viem types these as `as const`; the underlying signature accepts the
   *  literal shape so cast through unknown. */
  const sig = await account.signTypedData({
    domain: SNAPSHOT_DOMAIN as { name: string; version: string },
    types: UPDATE_USER_TYPES as unknown as Record<string, { name: string; type: string }[]>,
    primaryType: 'Profile',
    message,
  });
  const result = await postSignedEnvelope({
    address: account.address, sig,
    data: { domain: SNAPSHOT_DOMAIN, types: UPDATE_USER_TYPES, message },
  });
  storeCachedProfile(profile);
  return result;
}

/** Upload a File via pineapple → returns `ipfs://<cid>`. Validates JPEG/PNG
 *  and the 1 MB limit sx-monorepo enforces. */
const MAX_AVATAR_BYTES = 1024 * 1024;
export async function uploadAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
    throw new Error('Only JPEG and PNG images are supported.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error(`Image must be under ${MAX_AVATAR_BYTES / 1024} KB.`);
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(PINEAPPLE_UPLOAD_URL, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({})) as {
    result?: { cid?: string }; error?: { message?: string };
  };
  if (json.error?.message) throw new Error(json.error.message);
  const cid = json.result?.cid;
  if (!cid) throw new Error('Pineapple returned no CID');
  return `ipfs://${cid}`;
}

export type { SnapshotProfile };
