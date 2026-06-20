
const STAMP_URL = 'https://stamp.fyi';

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

export function isAddressLike(input: string | undefined | null): input is string {
  return !!input && /^0x[0-9a-fA-F]{40}$/.test(input.trim());
}

export function isDomainLike(input: string | undefined | null): input is string {
  if (!input) return false;
  const v = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/.test(v) && v.includes('.');
}

export async function resolveSearchInputToAddress(query: string): Promise<string | null> {
  const v = query.trim();
  if (isAddressLike(v)) return v;
  if (isDomainLike(v)) return await resolveDomain(v);
  return null;
}
