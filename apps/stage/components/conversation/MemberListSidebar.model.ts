export interface MemberListEntry {
  address: string;
  name: string;
  named: boolean;
}

function compareEntries(a: MemberListEntry, b: MemberListEntry): number {
  if (a.named !== b.named) return a.named ? -1 : 1;
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return byName === 0 ? a.address.toLowerCase().localeCompare(b.address.toLowerCase()) : byName;
}

export function memberListEntries(
  addresses: string[],
  nameOf: (address: string) => string | null | undefined,
  shortOf: (address: string) => string,
): MemberListEntry[] {
  const seen = new Set<string>();
  const entries: MemberListEntry[] = [];
  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = nameOf(address) ?? '';
    entries.push(name === '' ? { address, name: shortOf(address), named: false } : { address, name, named: true });
  }
  return entries.sort(compareEntries);
}
