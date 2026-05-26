/** Cross-platform Stamp API helpers — domain ↔ address resolution + avatar
 *  URL. Mirrors `sx-monorepo/apps/ui/src/helpers/stamp.ts` but pared down to
 *  what messenger surfaces need.
 *
 *  Used by mobile + web search to let users type "fabien.eth" and resolve
 *  to an address before opening the profile view. */

const STAMP_URL = 'https://stamp.fyi';

/** Resolve a single ENS-like domain (`name.eth`, `name.lens`, …) to its
 *  Ethereum address via the Stamp API. Returns null on miss / network
 *  failure rather than throwing — call-sites use this as a "best effort
 *  enrichment" of search input. */
export async function resolveDomain(domain: string, chainId = 1): Promise<string | null> {
  if (!isDomainLike(domain)) return null;
  try {
    const res = await fetch(STAMP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'resolve_names', params: [domain], network: chainId }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { result?: Record<string, string> };
    const addr = json.result?.[domain];
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
    return addr;
  } catch { return null; }
}

/** Reverse lookup — turn an Ethereum address into its primary ENS-like name
 *  if one is registered. Returns null on miss. */
export async function lookupName(address: string): Promise<string | null> {
  if (!isAddressLike(address)) return null;
  try {
    const res = await fetch(STAMP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'lookup_addresses', params: [address.toLowerCase()] }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { result?: Record<string, string> };
    return json.result?.[address.toLowerCase()] ?? null;
  } catch { return null; }
}

/** True when the input looks like a 0x-prefixed 40-hex-char Ethereum address. */
export function isAddressLike(input: string | undefined | null): input is string {
  return !!input && /^0x[0-9a-fA-F]{40}$/.test(input.trim());
}

/** True when the input looks like a tld'd handle that Stamp can resolve. */
export function isDomainLike(input: string | undefined | null): input is string {
  if (!input) return false;
  const v = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/.test(v) && v.includes('.');
}

/** Best-effort: take a free-form search query, return the resolved 0x address
 *  if it's either already an address or a domain Stamp knows about. */
export async function resolveSearchInputToAddress(query: string): Promise<string | null> {
  const v = query.trim();
  if (isAddressLike(v)) return v;
  if (isDomainLike(v)) return await resolveDomain(v);
  return null;
}
