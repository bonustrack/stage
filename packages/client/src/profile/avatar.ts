
export const STAMP_URL = 'https://stamp.fyi';

export function avatarRenderUrl(address: string, avatar: string | undefined, size = 120): string {
  if (!avatar) return `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  if (avatar.startsWith('ipfs://')) return `https://snapshot.4everland.link/ipfs/${avatar.slice(7)}`;
  return avatar;
}
