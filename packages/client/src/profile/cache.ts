export interface SnapshotProfile {
  name?: string;
  about?: string;
  avatar?: string;
  github?: string;
  twitter?: string;
  lens?: string;
  farcaster?: string;
}

export const PROFILE_CACHE_PREFIX = 'profile.cache.';

export function profileCacheKey(address: string): string {
  return PROFILE_CACHE_PREFIX + address.toLowerCase();
}

export function parseProfile(raw: string | null): SnapshotProfile | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SnapshotProfile;
  } catch {
    return null;
  }
}

export function serializeProfile(profile: SnapshotProfile): string {
  return JSON.stringify(profile);
}
