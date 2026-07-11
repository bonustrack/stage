export interface OutboxItem {
  id: string;
  address: string;
  text: string;
  createdAt: number;
}

export function deserializeOutbox(raw: string): OutboxItem[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const items: OutboxItem[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) return undefined;
      const r = entry as Record<string, unknown>;
      if (
        typeof r.id !== 'string' ||
        typeof r.address !== 'string' ||
        typeof r.text !== 'string' ||
        typeof r.createdAt !== 'number'
      ) return undefined;
      items.push({ id: r.id, address: r.address, text: r.text, createdAt: r.createdAt });
    }
    return items;
  } catch {
    return undefined;
  }
}

export function itemsForAddress(items: OutboxItem[], address: string): OutboxItem[] {
  const target = address.toLowerCase();
  return items
    .filter(i => i.address === target)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function addressesWithQueued(items: OutboxItem[]): string[] {
  return [...new Set(items.map(i => i.address))];
}

export function withoutItem(items: OutboxItem[], id: string): OutboxItem[] {
  return items.filter(i => i.id !== id);
}

export function pendingBanner(reason: 'unregistered' | 'stale-installations' | 'failed', shortAddress: string): string {
  if (reason === 'unregistered') {
    return `${shortAddress} isn't on XMTP yet. Messages you send now will be delivered when they join.`;
  }
  if (reason === 'stale-installations') {
    return `${shortAddress}'s device keys have expired. Messages you send now will be delivered when they open an XMTP app.`;
  }
  return 'This conversation cannot be opened right now. Messages you send now will be delivered once it can.';
}
