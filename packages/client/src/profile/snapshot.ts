/**
 * @file Stamp.fyi read-only identity helpers (avatar render URL, ENS endpoint) shared by web and mobile.
 */
/** Stamp.fyi identity helpers shared by web (apps/ui) and mobile (apps/app). Identity is READ-ONLY and resolved entirely from stamp.fyi / ENS — there is no in-app profile editing and no Snapshot hub usage. Keep dependency-free. */

/** stamp.fyi JSON-RPC endpoint. Snapshot's own UI resolves display names from here (`lookup_addresses` → ENS) and serves identicon/ENS avatars. */
export const STAMP_URL = 'https://stamp.fyi';

/** Resolve a stored avatar (ipfs hash or URL) to a renderable HTTP URL. Falls back to the stamp.fyi identicon when the field is empty. */
export function avatarRenderUrl(address: string, avatar: string | undefined, size = 120): string {
  if (!avatar) return `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  if (avatar.startsWith('ipfs://')) return `https://snapshot.4everland.link/ipfs/${avatar.slice(7)}`;
  return avatar;
}
