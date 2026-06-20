/** @file Inbox-id to ETH-address cache plus a pure cache-first resolution rule that keeps channel re-summarizes (poll, stream, resume, pull-to-refresh) under XMTP read limits by reusing stable cached identities; the native inboxStates fetch lives in the host, not here. */

/** The minimal cache surface the resolution rule needs. The SDK's default `InboxEthCache` implements it; the RN app can also pass its existing pub/sub-backed MemoryStore adapter so the SDK rule drives ONE cache instead of duplicating the store. */
export interface InboxEthStore {
  get(inboxId: string): string | undefined;
  set(inboxId: string, eth: string): void;
  has(inboxId: string): boolean;
}

/** A tiny in-memory inbox-id -> ETH-address cache. Distinct class (rather than a bare Map) so the resolution rule has one place to clear on account switch and the host can inject a richer store later if needed. */
export class InboxEthCache implements InboxEthStore {
  private readonly map = new Map<string, string>();

  /** Return the cached ETH address for an inbox id, or undefined when unknown. */
  get(inboxId: string): string | undefined { return this.map.get(inboxId); }
  /** Cache the ETH address resolved for an inbox id. */
  set(inboxId: string, eth: string): void { this.map.set(inboxId, eth); }
  /** True when an inbox id's ETH address is already cached. */
  has(inboxId: string): boolean { return this.map.has(inboxId); }
  /** Wipe everything — call on account switch (the cache is keyed to one inbox's view, but identities are global; clearing is the safe default). */
  clear(): void { this.map.clear(); }
}

/** A fetcher that resolves a batch of inbox ids to ETH addresses over the network. The host implements it on top of the native client's `inboxStates(true, ids)`; missing ids may be absent from the returned map. */
export type InboxEthFetcher = (ids: string[]) => Promise<Record<string, string>>;

/** Cache-first batch resolve: cached ids cost zero reads while deduped uncached ids are fetched in one `fetchMissing` call, primed, and merged; returns `{ inboxId -> eth }` for every id that resolved. */
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

/** Pre-warms the cache for many ids in one network call (no return) so the channels list's later per-row resolves are pure cache hits; best-effort, a fetch failure leaves the cache untouched. */
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
  } catch { /* best-effort — per-row resolveInboxEthCached still falls back */ }
}
