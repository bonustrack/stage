
export type AvatarSize = 'sm' | 'md' | 'lg';

export const AVATAR_SIZES: Record<AvatarSize, number> = {
  sm: 24,
  md: 32,
  lg: 64,
};

export function stampAvatarUrl(address: string, displayPx: number, cacheBust?: string | number): string {
  const fetchPx = displayPx * 2;
  const base = `https://cdn.stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${fetchPx}`;
  return cacheBust === undefined ? base : `${base}&cb=${cacheBust}`;
}

export function channelStampSeed(channelId: string): string {
  const hex = channelId.toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '');
  if (hex.length === 0) return `0x${'0'.repeat(40)}`;
  let out = hex;
  while (out.length < 40) out += hex;
  return `0x${out.slice(0, 40)}`;
}

export function channelAvatarUrl(channelId: string, imageUrl: string | null | undefined, displayPx: number): string {
  if (imageUrl?.trim()) return imageUrl;
  return stampAvatarUrl(channelStampSeed(channelId), displayPx);
}

export function stampTokenUrl(chainId: number, contract: string, displayPx: number): string {
  const fetchPx = displayPx * 2;
  return `https://cdn.stamp.fyi/token/eip155:${chainId}:${contract.toLowerCase()}?s=${fetchPx}`;
}

export function withStampDisplayPx(url: string, displayPx: number): string {
  if (!/[?&]s=\d+/.test(url)) return url;
  return url.replace(/([?&]s=)\d+/, `$1${displayPx * 2}`);
}

export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
