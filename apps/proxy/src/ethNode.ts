import { getCurrentPrices, getPriceChanges } from '@stage-labs/client/api/defillama';
import { corsHeaders, corsResponse, jsonResponse } from './respond.ts';

export const ETH_NODE_PATH = '/nodes/eth-price';

const COIN = 'coingecko:ethereum';
const CACHE_SECONDS = 20;
const CACHE_KEY = 'https://proxy.stage.box/nodes/eth-price?cached=widget';
const NODE_CORS = corsHeaders('GET, POST, OPTIONS', 'content-type, stage-key, stage-timestamp, stage-signature');
const NO_STORE = { ...NODE_CORS, 'cache-control': 'no-store' };
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface EthQuote { usd: number; change: number | null; at: number }

type Widget = Record<string, unknown>;

async function ethQuote(): Promise<EthQuote | null> {
  try {
    const [prices, changes] = await Promise.all([getCurrentPrices([COIN]), getPriceChanges([COIN]).catch((): Record<string, number> => ({}))]);
    const price = prices[COIN];
    return price === undefined ? null : { usd: price.usd, change: changes[COIN] ?? null, at: price.timestamp * 1000 };
  } catch {
    return null;
  }
}

function changeBadge(change: number | null): Widget[] {
  if (change === null) return [];
  const label = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h`;
  return [{ type: 'Badge', label, color: change >= 0 ? 'success' : 'danger' }];
}

export function ethWidget(quote: EthQuote | null): Widget {
  const time = quote === null ? '' : new Date(quote.at).toISOString().slice(11, 19);
  return {
    type: 'Card',
    size: 'sm',
    children: [
      { type: 'Row', children: [{ type: 'Caption', value: 'Ethereum', size: 'sm' }, { type: 'Spacer' }, ...changeBadge(quote?.change ?? null)] },
      { type: 'Title', value: quote === null ? 'Unavailable' : USD.format(quote.usd), size: '3xl' },
      { type: 'Caption', value: quote === null ? 'The price source did not answer' : `Price at ${time} UTC` },
      {
        type: 'Row',
        children: [{ type: 'Button', label: 'Refresh', iconStart: 'reload', variant: 'outline', size: 'sm', onClickAction: { type: 'refresh' } }],
      },
    ],
  };
}

function cachedQuote(raw: unknown): EthQuote | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.usd !== 'number' || typeof o.at !== 'number') return null;
  return { usd: o.usd, at: o.at, change: typeof o.change === 'number' ? o.change : null };
}

async function currentWidget(cache: Cache | undefined): Promise<Widget> {
  const key = new Request(CACHE_KEY);
  const hit = await cache?.match(key);
  if (hit) return ethWidget(cachedQuote(await hit.json()));
  const quote = await ethQuote();
  if (quote !== null && cache !== undefined) {
    await cache.put(key, jsonResponse(quote, 200, { 'cache-control': `public, max-age=${CACHE_SECONDS}` }));
  }
  return ethWidget(quote);
}

function actionType(body: string): string | null {
  try {
    const action = (JSON.parse(body) as { params?: { action?: { type?: unknown } } }).params?.action?.type;
    return typeof action === 'string' ? action : null;
  } catch {
    return null;
  }
}

export async function handleEthNode(request: Request, cache: Cache | undefined): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(NODE_CORS, null, 204);
  if (request.method !== 'GET' && request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405, NO_STORE);
  if (request.method === 'GET') return jsonResponse(await currentWidget(cache), 200, NO_STORE);
  if (actionType(await request.text()) !== 'refresh') return jsonResponse({}, 200, NO_STORE);
  return jsonResponse({ updated_item: { type: 'widget', widget: await currentWidget(cache) } }, 200, NO_STORE);
}
