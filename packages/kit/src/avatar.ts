/** @file Framework-agnostic avatar contract: the shared size scale plus the identicon URL helper that the per-framework RN and Vue renderers consume so web and mobile never drift. */

export type AvatarSize = 'sm' | 'md' | 'lg';

/** Canonical pixel sizes for each `AvatarSize` step. Tailwind-style names so callers read like `<Avatar size="lg" />`. Bumping any value here lands in both clients in a single PR. */
export const AVATAR_SIZES: Record<AvatarSize, number> = {
  sm: 24,
  md: 32,
  lg: 64,
};

/** stamp.fyi identicon URL for a wallet address, always requesting 2× the display px (WebP CDN, retina-crisp); `cacheBust` invalidates the CDN cache when an upstream profile-avatar changes. */
export function stampAvatarUrl(address: string, displayPx: number, cacheBust?: string | number): string {
  const fetchPx = displayPx * 2;
  const base = `https://cdn.stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${fetchPx}`;
  return cacheBust === undefined ? base : `${base}&cb=${cacheBust}`;
}

/** Derive a stable address-shaped (0x + 40 hex) seed from an arbitrary channel id so stamp.fyi renders a deterministic per-channel identicon: strip a leading `0x`, keep only hex chars, then pad/repeat to exactly 40 nibbles. Pure and deterministic, no hashing dependency. */
export function channelStampSeed(channelId: string): string {
  const hex = channelId.toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '');
  if (hex.length === 0) return `0x${'0'.repeat(40)}`;
  let out = hex;
  while (out.length < 40) out += hex;
  return `0x${out.slice(0, 40)}`;
}

/** stamp.fyi identicon for a channel/group with no uploaded image, seeded by the channel id via {@link channelStampSeed} for a unique stable fallback; returns `imageUrl` untouched when one exists, so call sites use it as the single source of truth. */
export function channelAvatarUrl(channelId: string, imageUrl: string | null | undefined, displayPx: number): string {
  if (imageUrl?.trim()) return imageUrl;
  return stampAvatarUrl(channelStampSeed(channelId), displayPx);
}

/** stamp.fyi token-logo URL (ERC-20 contract or the ETH sentinel). Used by the wallet asset list — same family as the identicon above but the `token/` route, with the canonical Snapshot-style id. */
export function stampTokenUrl(chainId: number, contract: string, displayPx: number): string {
  const fetchPx = displayPx * 2;
  return `https://cdn.stamp.fyi/token/eip155:${chainId}:${contract.toLowerCase()}?s=${fetchPx}`;
}

/** Re-point an already-built stamp.fyi URL's `s=` size param at a NEW display size (requesting 2× for retina), for when a cached small-thumbnail URL is re-rendered larger and would otherwise upscale blurrily; pass the display px and `s` becomes displayPx*2, no-op when the URL has no `s=` param. */
export function withStampDisplayPx(url: string, displayPx: number): string {
  if (!/[?&]s=\d+/.test(url)) return url;
  return url.replace(/([?&]s=)\d+/, `$1${displayPx * 2}`);
}

/** Sentinel address Snapshot uses for native ETH on stamp.fyi. Matches sx-monorepo's `ETH_CONTRACT`. */
export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
