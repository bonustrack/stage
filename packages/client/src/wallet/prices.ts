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

export function fmtUsdValue(amount: string, priceUsd: number | null): string | null {
  if (priceUsd === null) return null;
  const n = Number(amount);
  if (!isFinite(n) || n === 0) return null;
  const v = n * priceUsd;
  if (v > 0 && v < 0.01) return '~<$0.01';
  const frac = v < 1 ? 4 : 2;
  return `~$${v.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: frac })}`;
}
