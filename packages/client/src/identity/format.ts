/** @file Pure, framework-agnostic address-shortening and stamp.fyi avatar-URL helpers shared by every client (re-exported via an app shim), using the bare `stamp.fyi/avatar` host distinct from kit's `cdn.stamp.fyi` token helper. */

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** stamp.fyi avatar URL for an address (CDN returns a generic identicon when unset, so no error fallback needed). Pass the on-screen DISPLAY px (not pre-doubled): it requests `s = displayPx * 2` for retina; `cacheBust` is appended as `&cb=…` and should change when the avatar changes so device + CDN refetch. */
export function stampAvatarUrl(address: string, displayPx = 60, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${displayPx * 2}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}
