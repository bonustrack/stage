/** @file Stamp.fyi read-only identity helpers (avatar render URL, ENS endpoint) shared by web and mobile, resolved entirely from stamp.fyi / ENS with no in-app profile editing or Snapshot hub usage; keep dependency-free. */

/** stamp.fyi JSON-RPC endpoint. Snapshot's own UI resolves display names from here (`lookup_addresses` → ENS) and serves identicon/ENS avatars. */
export const STAMP_URL = 'https://stamp.fyi';

/** Resolve a stored avatar (ipfs hash or URL) to a renderable HTTP URL. Falls back to the stamp.fyi identicon when the field is empty. */
export function avatarRenderUrl(address: string, avatar: string | undefined, size = 120): string {
  if (!avatar) return `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  if (avatar.startsWith('ipfs://')) return `https://snapshot.4everland.link/ipfs/${avatar.slice(7)}`;
  return avatar;
}
