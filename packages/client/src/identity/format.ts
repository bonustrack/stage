
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function stampAvatarUrl(address: string, displayPx = 60, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${displayPx * 2}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}
