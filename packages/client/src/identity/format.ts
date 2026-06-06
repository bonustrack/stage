/** Pure address-display + stamp.fyi avatar helpers. Framework-agnostic, shared
 *  by every client. Moved out of apps/app's xmtp.types for the Stage SDK; the
 *  app re-exports them from that shim so call sites stay stable.
 *
 *  NOTE: this uses the bare `stamp.fyi/avatar` host (matching sx-monorepo's
 *  `apps/ui/src/helpers/stamp.ts`), distinct from kit's `cdn.stamp.fyi` token
 *  helper — behaviour is preserved verbatim from the app. */

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** stamp.fyi avatar URL for an Ethereum address. The CDN returns a 200 with a
 *  generic identicon when no custom avatar is set, so callers can render this
 *  URL directly without a network-error fallback.
 *
 *  Takes the DISPLAY px and internally requests `s = displayPx * 2` so every
 *  call site renders a crisp retina (2×) identicon from a single source of
 *  truth. Pass the on-screen size, NOT a pre-doubled value.
 *
 *  `cacheBust` is appended verbatim as `&cb=…` — pass a value that changes when
 *  the underlying avatar changes (e.g. the last few chars of the IPFS CID
 *  stored in profile.avatar) so the device + stamp CDN refetch instead of
 *  serving the previous image. */
export function stampAvatarUrl(address: string, displayPx = 60, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${displayPx * 2}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}
