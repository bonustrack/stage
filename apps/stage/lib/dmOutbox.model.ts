export interface OutboxItem {
  id: string;
  address: string;
  text: string;
  createdAt: number;
  accountId?: string;
}

function parseItem(entry: unknown): OutboxItem | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const r = entry as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.address !== 'string' || typeof r.text !== 'string' || typeof r.createdAt !== 'number') {
    return null;
  }
  const accountId = typeof r.accountId === 'string' ? { accountId: r.accountId } : {};
  return { id: r.id, address: r.address, text: r.text, createdAt: r.createdAt, ...accountId };
}

export function deserializeOutbox(raw: string): OutboxItem[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const items = parsed.map(parseItem);
    return items.every((i): i is OutboxItem => i !== null) ? items : undefined;
  } catch {
    return undefined;
  }
}

function belongsTo(item: OutboxItem, accountId: string | null): boolean {
  return accountId === null || item.accountId === undefined || item.accountId === accountId;
}

export function itemsForAddress(items: OutboxItem[], address: string, accountId: string | null): OutboxItem[] {
  const target = address.toLowerCase();
  return items
    .filter(i => i.address === target && belongsTo(i, accountId))
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function addressesWithQueued(items: OutboxItem[], accountId: string | null): string[] {
  return [...new Set(items.filter(i => belongsTo(i, accountId)).map(i => i.address))];
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
