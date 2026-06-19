/**
 * @file Inbox-id to ETH-address cache plus cache-first resolution rule that keeps channel re-summarizes under XMTP read limits.
 */
/**
 * inbox-id -> ETH-address cache MECHANISM + cache-first resolution RULE.
 *
 *  An inbox's ETH identity is stable, so once resolved we never need to hit the
 *  identity API for it again. This cache is the key to staying under XMTP's read
 *  rate limit: channel re-summarizes (poll, per-message stream, AppState resume,
 *  pull-to-refresh) reuse cached identities instead of calling
 *  GetIdentityUpdates per member on every pass.
 *
 *  The CACHE (this Map) and the RESOLUTION RULE (collect uncached ids, fetch the
 *  missing batch via an injected fetcher, prime, return) are pure and live here.
 *  The native `inboxStates(true, ids)` fetch is NOT here — it touches the native
 *  client and is supplied by the host through `MessagingTransport.inboxEthAddresses`
 *  (or any `(ids) => Promise<Record<id, eth>>` fetcher).
 */

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

/**
 * Cache-first batch resolve: cached ids cost zero network reads; only the
 *  uncached ids are fetched (in ONE call) via `fetchMissing`, primed into the
 *  cache, and merged into the result. De-dupes ids. Returns `{ inboxId -> eth }`
 *  for every id that resolved (cached or freshly fetched).
 */
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

/**
 * Pre-warm the cache for many ids in ONE network call (no return value).
 *  Used by the channels list to prime member identities before summarising rows
 *  so each row's later resolve is a pure cache hit. Best-effort: a fetch failure
 *  leaves the cache untouched and per-row resolves fall back.
 */
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
