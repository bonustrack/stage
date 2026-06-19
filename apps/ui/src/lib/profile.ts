/** Read-only identity for the web app. Identity is resolved ENTIRELY from
 *  stamp.fyi (the same source Snapshot's own UI uses): display names via ENS
 *  lookup, avatars via the stamp.fyi identicon (handled at the render site by
 *  `avatarRenderUrl`). There is no in-app profile editing and no Snapshot hub
 *  usage — identity is read-only for the local user and every peer alike, the
 *  same model as the mobile app (`@stage-labs/client/identity/peerProfiles`). */

import { lookupName } from '@stage-labs/client/stamp/resolve';

/** Minimal display profile. Only `name` is populated (from ENS); the remaining
 *  fields are retained so existing templates can keep their optional guards,
 *  but are never set in the stamp-only model. */
export interface SnapshotProfile {
  name?: string;
  about?: string;
  avatar?: string;
  github?: string;
  twitter?: string;
  lens?: string;
  farcaster?: string;
}

/** Per-address cache key. A single shared key would let every peer lookup
 *  (incl. peers with no ENS, cached as `{}`) clobber the SELF profile, blanking
 *  the user's own name on the Profile tab — so the cache is keyed by address,
 *  exactly like the mobile peerProfiles store. */
const PROFILE_CACHE_PREFIX = 'profile.cache.';

/** Cache Key. */
function cacheKey(address: string): string {
  return PROFILE_CACHE_PREFIX + address.toLowerCase();
}

/** Read a cached Snapshot profile for an address from localStorage, or null when absent. */
export function loadCachedProfile(address: string): SnapshotProfile | null {
  if (!address) return null;
  try {
    const raw = localStorage.getItem(cacheKey(address));
    return raw ? JSON.parse(raw) as SnapshotProfile : null;
  } catch { return null; }
}

/** Set the Cached Profile. */
function storeCachedProfile(address: string, profile: SnapshotProfile): void {
  if (!address) return;
  try { localStorage.setItem(cacheKey(address), JSON.stringify(profile)); }
  catch { /* quota — ignore */ }
}

/** Resolve a display profile for an address from stamp.fyi (ENS name). Misses
 *  resolve to an empty profile; consumers fall back to the truncated address
 *  and the stamp identicon avatar. Self + peers share this one path. */
export async function readProfile(address: string): Promise<SnapshotProfile | null> {
  try {
    const name = await lookupName(address);
    const profile: SnapshotProfile = name ? { name } : {};
    storeCachedProfile(address, profile);
    return profile;
  } catch {
    return loadCachedProfile(address);
  }
}

/** Pineapple image-pinning service (IPFS upload). Returns `{result:{cid}}`.
 *  This is the only profile-related write left in the web app: it backs the
 *  GROUP avatar upload (not user identity, which is read-only from stamp.fyi). */
const PINEAPPLE_UPLOAD_URL = 'https://pineapple.fyi/upload';
const MAX_AVATAR_BYTES = 1024 * 1024;

/** Upload a File via pineapple → returns `ipfs://<cid>`. Validates JPEG/PNG
 *  and the 1 MB limit sx-monorepo enforces. */
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
