import { getCurrentPrices, getPriceChanges } from '@stage-labs/client/api/defillama';
import { corsHeaders, corsResponse, jsonResponse } from './respond.ts';

interface PriceAsset { coin: string; name: string }

const PRICE_NODES: ReadonlyMap<string, PriceAsset> = new Map([
  ['/nodes/eth-price', { coin: 'coingecko:ethereum', name: 'Ethereum' }],
  ['/nodes/btc-price', { coin: 'coingecko:bitcoin', name: 'Bitcoin' }],
]);

const CACHE_SECONDS = 20;
const LOAD_MAX_AGE_MS = CACHE_SECONDS * 1000;
const TAP_MAX_AGE_MS = 5000;
const NODE_CORS = corsHeaders('GET, POST, OPTIONS', 'content-type, stage-key, stage-timestamp, stage-signature');
const NO_STORE = { ...NODE_CORS, 'cache-control': 'no-store' };
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Quote { usd: number; change: number | null; at: number }

type Widget = Record<string, unknown>;

export const isPriceNodePath = (pathname: string): boolean => PRICE_NODES.has(pathname);

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

export function priceWidget(name: string, quote: Quote | null): Widget {
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

async function currentWidget(path: string, asset: PriceAsset, cache: Cache | undefined, maxAgeMs: number): Promise<Widget> {
  const key = new Request(`https://proxy.stage.box${path}?cached=widget`);
  const hit = await cache?.match(key);
  const cached = hit ? cachedQuote(await hit.json()) : null;
  if (cached !== null && Date.now() - cached.at < maxAgeMs) return priceWidget(asset.name, cached);
  const quote = await fetchQuote(asset.coin);
  if (quote !== null && cache !== undefined) {
    await cache.put(key, jsonResponse(quote, 200, { 'cache-control': `public, max-age=${CACHE_SECONDS}` }));
  }
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
  const path = new URL(request.url).pathname;
  const asset = PRICE_NODES.get(path);
  if (asset === undefined) return jsonResponse({ error: 'not found' }, 404, NO_STORE);
  if (request.method === 'OPTIONS') return corsResponse(NODE_CORS, null, 204);
  if (request.method !== 'GET' && request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405, NO_STORE);
  if (request.method === 'GET') return jsonResponse(await currentWidget(path, asset, cache, LOAD_MAX_AGE_MS), 200, NO_STORE);
  if (actionType(await request.text()) !== 'refresh') return jsonResponse({}, 200, NO_STORE);
  return jsonResponse({ updated_item: { type: 'widget', widget: await currentWidget(path, asset, cache, TAP_MAX_AGE_MS) } }, 200, NO_STORE);
}
