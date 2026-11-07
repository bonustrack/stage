import { getCurrentPrices } from '../api/defillama';

const TTL_MS = 60_000;
const cache = new Map<string, { usd: number; at: number }>();
const inflight = new Map<string, Promise<number | null>>();

export async function fetchUsdPrice(id: string | null): Promise<number | null> {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.usd;
  const pending = inflight.get(id);
  if (pending) return pending;
  const p = (async () => {
    try {
      const usd = (await getCurrentPrices([id]))[id]?.usd;
      if (usd === undefined) return null;
      cache.set(id, { usd, at: Date.now() });
      return usd;
    } catch {
      return null;
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  return p;
}
