
import { lookupName } from '@stage-labs/client/stamp/resolve';

export interface SnapshotProfile {
  name?: string;
  about?: string;
  avatar?: string;
  github?: string;
  twitter?: string;
  lens?: string;
  farcaster?: string;
}

const PROFILE_CACHE_PREFIX = 'profile.cache.';

function cacheKey(address: string): string {
  return PROFILE_CACHE_PREFIX + address.toLowerCase();
}

export function loadCachedProfile(address: string): SnapshotProfile | null {
  if (!address) return null;
  try {
    const raw = localStorage.getItem(cacheKey(address));
    return raw ? JSON.parse(raw) as SnapshotProfile : null;
  } catch { return null; }
}

function storeCachedProfile(address: string, profile: SnapshotProfile): void {
  if (!address) return;
  try { localStorage.setItem(cacheKey(address), JSON.stringify(profile)); }
  catch { }
}

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

const PINEAPPLE_UPLOAD_URL = 'https://pineapple.fyi/upload';
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
