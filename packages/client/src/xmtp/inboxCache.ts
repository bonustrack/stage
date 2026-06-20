
export interface InboxEthStore {
  get(inboxId: string): string | undefined;
  set(inboxId: string, eth: string): void;
  has(inboxId: string): boolean;
}

export class InboxEthCache implements InboxEthStore {
  private readonly map = new Map<string, string>();

  get(inboxId: string): string | undefined { return this.map.get(inboxId); }
  set(inboxId: string, eth: string): void { this.map.set(inboxId, eth); }
  has(inboxId: string): boolean { return this.map.has(inboxId); }
  clear(): void { this.map.clear(); }
}

export type InboxEthFetcher = (ids: string[]) => Promise<Record<string, string>>;

export async function resolveInboxEthCached(
  cache: InboxEthStore,
  fetchMissing: InboxEthFetcher,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    const cached = cache.get(id);
    if (cached) out[id] = cached;
    else if (!missing.includes(id)) missing.push(id);
  }
  if (missing.length > 0) {
    const fetched = await fetchMissing(missing);
    for (const id of missing) {
      const eth = fetched[id];
      if (eth) { out[id] = eth; cache.set(id, eth); }
    }
  }
  return out;
}

export async function primeInboxEthCache(
  cache: InboxEthStore,
  fetchMissing: InboxEthFetcher,
  ids: string[],
): Promise<void> {
  const missing = [...new Set(ids)].filter(id => id && !cache.has(id));
  if (missing.length === 0) return;
  try {
    const fetched = await fetchMissing(missing);
    for (const id of missing) {
      const eth = fetched[id];
      if (eth) cache.set(id, eth);
    }
  } catch { }
}
