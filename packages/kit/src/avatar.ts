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

/** stamp.fyi token-logo URL (ERC-20 contract or the ETH sentinel).
 *  Used by the wallet asset list — same family as the identicon above
 *  but the `token/` route, with the canonical Snapshot-style id. */
export function stampTokenUrl(chainId: number, contract: string, displayPx: number): string {
  const fetchPx = displayPx * 2;
  return `https://cdn.stamp.fyi/token/eip155:${chainId}:${contract.toLowerCase()}?s=${fetchPx}`;
}

/** Sentinel address Snapshot uses for native ETH on stamp.fyi.
 *  Matches sx-monorepo's `ETH_CONTRACT`. */
export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
