/** Snapshot hub endpoints + EIP-712 schema shared by web (apps/ui) and mobile
 *  (apps/app). Mirrors the constants in sx-monorepo's
 *  `packages/sx.js/src/clients/offchain/ethereum-sig/{index,types}.ts` so the
 *  hub accepts envelopes we sign locally. Keep dependency-free. */

/** GraphQL endpoint for read queries (profile, spaces, …). */
export const SNAPSHOT_HUB_GRAPHQL = 'https://hub.snapshot.org/graphql';

/** Sequencer accepts user-signed EIP-712 envelopes (vote, follow, updateUser…). */
export const SNAPSHOT_SEQUENCER_URL = 'https://seq.snapshot.org';

/** Pineapple image-pinning service (IPFS upload). Returns `{result:{cid}}`. */
export const PINEAPPLE_UPLOAD_URL = 'https://pineapple.fyi/upload';

/** EIP-712 domain — matches sx-monorepo `domain` in
 *  `packages/sx.js/src/clients/offchain/ethereum-sig/types.ts`. */
export const SNAPSHOT_DOMAIN = { name: 'snapshot', version: '0.1.4' } as const;

/** EIP-712 types for the `updateUser` envelope. */
export const UPDATE_USER_TYPES = {
  Profile: [
    { name: 'from', type: 'string' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'profile', type: 'string' },
  ],
} as const;

/** Editable profile fields. Same shape sx-monorepo's EditUser modal collects. */
export interface SnapshotProfile {
  name?: string;
  about?: string;
  avatar?: string;
  github?: string;
  twitter?: string;
  lens?: string;
  farcaster?: string;
}

/** Maximum lengths sx-monorepo enforces (see `EditUser.vue` definition). */
export const PROFILE_FIELD_LIMITS = {
  name: 32, about: 256, github: 39, twitter: 15, lens: 26, farcaster: 17,
} as const;

/** Resolve a stored avatar (ipfs hash or URL) to a renderable HTTP URL.
 *  Falls back to the stamp.fyi identicon when the field is empty. */
export function avatarRenderUrl(address: string, avatar: string | undefined, size = 120): string {
  if (!avatar) return `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  if (avatar.startsWith('ipfs://')) return `https://snapshot.4everland.link/ipfs/${avatar.slice(7)}`;
  return avatar;
}

/** GraphQL request for the canonical Snapshot user record. */
export const USER_QUERY = `query User($id: String!) {
  user(id: $id) { id name about avatar cover github twitter lens farcaster created }
}`;

export interface UserQueryResult {
  user: ({ id: string; created?: number | null } & SnapshotProfile & { cover?: string }) | null;
}

/** Fetch the current profile for an address. Returns null when the hub has no
 *  record (a brand-new wallet) or the request fails. Lowercases the address —
 *  the hub stores everything lower-cased. */
export async function fetchSnapshotProfile(address: string): Promise<SnapshotProfile | null> {
  try {
    const res = await fetch(SNAPSHOT_HUB_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: USER_QUERY, variables: { id: address.toLowerCase() } }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: UserQueryResult };
    const u = json.data?.user;
    if (!u) return null;
    return {
      name: u.name ?? '',
      about: u.about ?? '',
      avatar: u.avatar ?? '',
      github: u.github ?? '',
      twitter: u.twitter ?? '',
      lens: u.lens ?? '',
      farcaster: u.farcaster ?? '',
    };
  } catch { return null; }
}

/** Strip empty strings — sx-monorepo serialises the partial object, so leaving
 *  blanks in clobbers any previous value with "". Drop them. */
export function cleanProfile(p: SnapshotProfile): SnapshotProfile {
  const out: SnapshotProfile = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'string' && v.length > 0) (out as Record<string, string>)[k] = v;
  }
  return out;
}

/** Build the EIP-712 message payload the sequencer accepts. The signer wraps
 *  this and POSTs `{address, sig, data:{domain,types,message}}` to the
 *  sequencer URL. `timestamp` is unix seconds, matching sx-monorepo's
 *  `sign()` helper. */
export function buildUpdateUserMessage(address: string, profile: SnapshotProfile): {
  from: string; timestamp: number; profile: string;
} {
  return {
    from: address,
    timestamp: Math.floor(Date.now() / 1000),
    profile: JSON.stringify(cleanProfile(profile)),
  };
}

/** Submit a signed envelope to the sequencer. The sequencer rejects with
 *  `{error, error_description}`; throws on either. */
export async function postSignedEnvelope(payload: {
  address: string; sig: string;
  data: { domain: unknown; types: unknown; message: unknown };
}): Promise<unknown> {
  const res = await fetch(SNAPSHOT_SEQUENCER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({})) as { error?: unknown; error_description?: string };
  if (json.error) {
    const msg = typeof json.error_description === 'string' ? json.error_description
      : typeof json.error === 'string' ? json.error : 'Snapshot sequencer error';
    throw new Error(msg);
  }
  return json;
}
