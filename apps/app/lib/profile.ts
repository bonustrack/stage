/** Snapshot profile read/write on mobile. Signs an EIP-712 envelope with the
 *  local viem account (see lib/wallet.ts) and POSTs it to the Snapshot
 *  sequencer. Reads come from the hub's GraphQL endpoint. */

import * as SecureStore from 'expo-secure-store';
import { loadOrCreateAccount } from './wallet';
import {
  SNAPSHOT_DOMAIN, UPDATE_USER_TYPES, PINEAPPLE_UPLOAD_URL,
  buildUpdateUserMessage, postSignedEnvelope, fetchSnapshotProfile,
  type SnapshotProfile,
} from '@stage-labs/metro-client/profile/snapshot';

const PROFILE_CACHE_KEY = 'profile.cache';

/** Persist the most recently saved profile so the next mount shows it instantly
 *  without a fresh hub round-trip. Lazy on read — the in-memory cache lives
 *  for the session only. */
let memCache: SnapshotProfile | null = null;

export async function loadCachedProfile(): Promise<SnapshotProfile | null> {
  if (memCache) return memCache;
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_CACHE_KEY);
    if (!raw) return null;
    memCache = JSON.parse(raw) as SnapshotProfile;
    return memCache;
  } catch { return null; }
}

async function storeCachedProfile(profile: SnapshotProfile): Promise<void> {
  memCache = profile;
  try { await SecureStore.setItemAsync(PROFILE_CACHE_KEY, JSON.stringify(profile)); }
  catch { /* best-effort */ }
}

/** Fetch the live profile from the hub. Falls back to the local cache when the
 *  network is down. */
export async function readProfile(address: string): Promise<SnapshotProfile | null> {
  const remote = await fetchSnapshotProfile(address);
  if (remote) { await storeCachedProfile(remote); return remote; }
  return loadCachedProfile();
}

/** Sign + POST a profile update. Returns the sequencer's success payload.
 *  Throws when the sequencer rejects (validation error, rate limit, …). */
export async function updateProfile(profile: SnapshotProfile): Promise<unknown> {
  const account = await loadOrCreateAccount();
  const message = buildUpdateUserMessage(account.address, profile);
  /** viem's `signTypedData` returns `0x<r><s><v>` — exactly what the sequencer
   *  expects. The domain has no `chainId`/`verifyingContract`, matching
   *  sx-monorepo's `baseDomain`. */
  /** viem's typed signature wants mutable arrays; the shared constant is `as const`
   *  for the public API. Cast through unknown — the shapes match structurally. */
  const sig = await account.signTypedData({
    domain: SNAPSHOT_DOMAIN as { name: string; version: string },
    types: UPDATE_USER_TYPES as unknown as Record<string, { name: string; type: string }[]>,
    primaryType: 'Profile',
    message,
  });
  const result = await postSignedEnvelope({
    address: account.address,
    sig,
    data: {
      domain: SNAPSHOT_DOMAIN,
      types: UPDATE_USER_TYPES,
      message,
    },
  });
  await storeCachedProfile(profile);
  return result;
}

/** Upload an image to pineapple (Snapshot's IPFS gateway). Returns an
 *  `ipfs://<cid>` URI suitable to store as the `avatar` field. `uri` is a
 *  local file URI from expo-image-picker; `mime` is e.g. 'image/jpeg'. */
export async function uploadAvatar(uri: string, mime: string, name = 'avatar'): Promise<string> {
  const form = new FormData();
  /** RN's FormData accepts the `{uri, name, type}` shape — fetch streams the
   *  underlying file straight from disk; no need to base64-decode first. */
  form.append('file', { uri, name, type: mime } as unknown as Blob);
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
