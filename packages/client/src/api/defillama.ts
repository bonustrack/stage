import { z } from 'zod';
import { parseOrThrow } from '../validate';

const API = 'https://coins.llama.fi';
const envelope = z.object({ coins: z.record(z.unknown()) });
const quoteSchema = z.object({
  price: z.number().finite().positive(),
  timestamp: z.number().int().positive(),
  confidence: z.number().min(0.5).max(1),
});

export interface UsdQuote {
  usd: number;
  timestamp: number;
}

async function fetchCoins(path: string, ids: readonly string[]): Promise<Record<string, unknown>> {
  const coins = [...new Set(ids)].map(encodeURIComponent).join(',');
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, 15_000);
  try {
    const response = await fetch(`${API}/${path}/${coins}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`defillama ${response.status}`);
    return parseOrThrow('defillama', envelope, await response.json()).coins;
  } finally {
    clearTimeout(timer);
  }
}

export async function getCurrentPrices(ids: readonly string[]): Promise<Record<string, UsdQuote>> {
  if (ids.length === 0) return {};
  const coins = await fetchCoins('prices/current', ids);
  const prices: Record<string, UsdQuote> = {};
  const now = Date.now() / 1000;
  for (const id of ids) {
    const parsed = quoteSchema.safeParse(coins[id]);
    if (!parsed.success) continue;
    const { price, timestamp } = parsed.data;
    const age = now - timestamp;
    if (age < -60 || age > 15 * 60) continue;
    prices[id] = { usd: price, timestamp };
  }
  return prices;
}

export async function getPriceChanges(ids: readonly string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const coins = await fetchCoins('percentage', ids);
  const changes: Record<string, number> = {};
  for (const id of ids) {
    const change = coins[id];
    if (typeof change === 'number' && Number.isFinite(change)) changes[id] = change;
  }
  return changes;
}
