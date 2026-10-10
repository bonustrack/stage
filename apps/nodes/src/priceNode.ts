import { getCurrentPrices, getPriceChanges } from '@stage-labs/client/api/defillama';

interface PriceAsset { coin: string; name: string }

const PRICE_NODES: ReadonlyMap<string, PriceAsset> = new Map([
  ['/eth-price', { coin: 'coingecko:ethereum', name: 'Ethereum' }],
  ['/btc-price', { coin: 'coingecko:bitcoin', name: 'Bitcoin' }],
]);

const CACHE_SECONDS = 20;
const LOAD_MAX_AGE_MS = CACHE_SECONDS * 1000;
const TAP_MAX_AGE_MS = 5000;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, stage-key, stage-timestamp, stage-signature',
  'access-control-max-age': '86400',
};
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Quote { usd: number; change: number | null; at: number }

type Widget = Record<string, unknown>;

function json(body: unknown, status = 200, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl },
  });
}

async function fetchQuote(coin: string): Promise<Quote | null> {
  try {
    const [prices, changes] = await Promise.all([getCurrentPrices([coin]), getPriceChanges([coin]).catch((): Record<string, number> => ({}))]);
    const price = prices[coin];
    return price === undefined ? null : { usd: price.usd, change: changes[coin] ?? null, at: Date.now() };
  } catch {
    return null;
  }
}

function changeBadge(change: number | null): Widget[] {
  if (change === null) return [];
  const label = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h`;
  return [{ type: 'Badge', label, color: change >= 0 ? 'success' : 'danger' }];
}

function priceWidget(name: string, quote: Quote | null): Widget {
  const time = quote === null ? '' : new Date(quote.at).toISOString().slice(11, 19);
  return {
    type: 'Card',
    size: 'sm',
    children: [
      { type: 'Row', children: [{ type: 'Caption', value: name, size: 'sm' }, { type: 'Spacer' }, ...changeBadge(quote?.change ?? null)] },
      { type: 'Title', value: quote === null ? 'Unavailable' : USD.format(quote.usd), size: '3xl' },
      { type: 'Caption', value: quote === null ? 'The price source did not answer' : `Updated ${time} UTC` },
      {
        type: 'Row',
        children: [{ type: 'Button', label: 'Refresh', iconStart: 'reload', variant: 'outline', size: 'sm', onClickAction: { type: 'refresh' } }],
      },
    ],
  };
}

function cachedQuote(raw: unknown): Quote | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.usd !== 'number' || typeof o.at !== 'number') return null;
  return { usd: o.usd, at: o.at, change: typeof o.change === 'number' ? o.change : null };
}

async function currentWidget(request: Request, asset: PriceAsset, cache: Cache | undefined, maxAgeMs: number): Promise<Widget> {
  const key = new Request(new URL('?cached=widget', request.url));
  const hit = await cache?.match(key);
  const cached = hit ? cachedQuote(await hit.json()) : null;
  if (cached !== null && Date.now() - cached.at < maxAgeMs) return priceWidget(asset.name, cached);
  const quote = await fetchQuote(asset.coin);
  if (quote !== null && cache !== undefined) await cache.put(key, json(quote, 200, `public, max-age=${CACHE_SECONDS}`));
  return priceWidget(asset.name, quote ?? cached);
}

function actionType(body: string): string | null {
  try {
    const action = (JSON.parse(body) as { params?: { action?: { type?: unknown } } }).params?.action?.type;
    return typeof action === 'string' ? action : null;
  } catch {
    return null;
  }
}

export async function handlePriceNode(request: Request, cache: Cache | undefined): Promise<Response> {
  const asset = PRICE_NODES.get(new URL(request.url).pathname);
  if (asset === undefined) return json({ error: 'not found' }, 404);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (request.method === 'GET') return json(await currentWidget(request, asset, cache, LOAD_MAX_AGE_MS));
  if (actionType(await request.text()) !== 'refresh') return json({});
  return json({ updated_item: { type: 'widget', widget: await currentWidget(request, asset, cache, TAP_MAX_AGE_MS) } });
}
