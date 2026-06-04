/** Avatar primitives — sizes + URL helpers shared between web + mobile.
 *
 *  The actual <Avatar> renderer stays per-framework (RN component in
 *  apps/app, Vue SFC in apps/ui) for the same reason as HeroIcon: the
 *  rendering layers don't share JSX, but the *contract* — what sizes
 *  exist, what URL pattern serves the identicon — does. Centralising it
 *  here keeps web and mobile from drifting (different pixel sizes, one
 *  client forgetting the cache-buster, etc.). */

export type AvatarSize = 'sm' | 'md' | 'lg';

/** Canonical pixel sizes for each `AvatarSize` step. Tailwind-style names so
 *  callers read like `<Avatar size="lg" />`. Bumping any value here lands
 *  in both clients in a single PR. */
export const AVATAR_SIZES: Record<AvatarSize, number> = {
  sm: 24,
  md: 32,
  lg: 64,
};

/** stamp.fyi identicon URL for a wallet address. Always doubled the requested
 *  pixel size — the CDN serves WebP, retina rows stay crisp.
 *  `cacheBust` invalidates the CDN cache when an upstream profile-avatar
 *  changes (Metro reads it from the Snapshot hub on profile update). */
export function stampAvatarUrl(address: string, displayPx: number, cacheBust?: string | number): string {
  const fetchPx = displayPx * 2;
  const base = `https://cdn.stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${fetchPx}`;
  return cacheBust === undefined ? base : `${base}&cb=${cacheBust}`;
}

/** Derive a stable, address-shaped (0x + 40 hex) seed from an arbitrary channel
 *  id so stamp.fyi renders a deterministic per-channel identicon. XMTP group ids
 *  are already hex strings; we strip a leading `0x`, keep only hex chars, then
 *  pad/repeat to exactly 40 nibbles so the same channel always maps to the same
 *  avatar. Pure + deterministic — no hashing dependency needed. */
export function channelStampSeed(channelId: string): string {
  const hex = channelId.toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '');
  if (hex.length === 0) return `0x${'0'.repeat(40)}`;
  let out = hex;
  while (out.length < 40) out += hex;
  return `0x${out.slice(0, 40)}`;
}

/** stamp.fyi identicon for a CHANNEL/GROUP that has no uploaded image — seeded
 *  by the channel id (via {@link channelStampSeed}) so every channel gets a
 *  unique, stable fallback avatar. Returns `imageUrl` untouched when the channel
 *  DOES have an uploaded image, so call sites can use this as the single source
 *  of truth: `channelAvatarUrl(id, imageUrl, px)`. */
export function channelAvatarUrl(channelId: string, imageUrl: string | null | undefined, displayPx: number): string {
  if (imageUrl && imageUrl.trim()) return imageUrl;
  return stampAvatarUrl(channelStampSeed(channelId), displayPx);
}

/** stamp.fyi token-logo URL (ERC-20 contract or the ETH sentinel).
 *  Used by the wallet asset list — same family as the identicon above
 *  but the `token/` route, with the canonical Snapshot-style id. */
export function stampTokenUrl(chainId: number, contract: string, displayPx: number): string {
  const fetchPx = displayPx * 2;
  return `https://cdn.stamp.fyi/token/eip155:${chainId}:${contract.toLowerCase()}?s=${fetchPx}`;
}

/** Re-point an already-built stamp.fyi URL's `s=` (size) query param at a NEW
 *  display size, requesting 2× for retina crispness. Use when a cached stamp URL
 *  (built for a small list thumbnail, e.g. s=64 for a 32px row) is re-rendered at
 *  a LARGER size (e.g. the 72px token-detail logo) and would otherwise upscale a
 *  too-small image and look blurry. Pass the DISPLAY px; `s` becomes `displayPx*2`.
 *  No-ops (returns the input) when the URL has no `s=` param. */
export function withStampDisplayPx(url: string, displayPx: number): string {
  if (!/[?&]s=\d+/.test(url)) return url;
  return url.replace(/([?&]s=)\d+/, `$1${displayPx * 2}`);
}

/** Sentinel address Snapshot uses for native ETH on stamp.fyi.
 *  Matches sx-monorepo's `ETH_CONTRACT`. */
export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
