
export const STAMP_URL = 'https://stamp.fyi';

export function avatarRenderUrl(avatar: string): string {
  if (avatar.startsWith('ipfs://')) return `https://snapshot.4everland.link/ipfs/${avatar.slice(7)}`;
  return avatar;
}
