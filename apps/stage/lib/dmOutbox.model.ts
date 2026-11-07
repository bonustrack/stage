import { z } from 'zod';

const outboxItemSchema = z.object({
  id: z.string(),
  address: z.string(),
  text: z.string(),
  createdAt: z.number(),
  accountId: z.string().optional().catch(undefined),
});

export type OutboxItem = z.infer<typeof outboxItemSchema>;

export const outboxSchema = z.array(outboxItemSchema);

function belongsTo(item: OutboxItem, accountId: string | null): boolean {
  return accountId === null || item.accountId === undefined || item.accountId === accountId;
}

export function itemsForAddress(items: OutboxItem[], address: string, accountId: string | null): OutboxItem[] {
  const target = address.toLowerCase();
  return items.filter((i) => i.address === target && belongsTo(i, accountId)).sort((a, b) => a.createdAt - b.createdAt);
}

export function addressesWithQueued(items: OutboxItem[], accountId: string | null): string[] {
  return [...new Set(items.filter((i) => belongsTo(i, accountId)).map((i) => i.address))];
}

export function withoutItem(items: OutboxItem[], id: string): OutboxItem[] {
  return items.filter((i) => i.id !== id);
}

export function pendingBanner(reason: 'unregistered' | 'stale-installations' | 'failed', shortAddress: string): string {
  if (reason === 'unregistered') return `${shortAddress} isn't on XMTP yet. Messages you send now will be delivered when they join.`;
  if (reason === 'stale-installations') {
    return `${shortAddress}'s device keys have expired. Messages you send now will be delivered when they open an XMTP app.`;
  }
  return 'This conversation cannot be opened right now. Messages you send now will be delivered once it can.';
}
