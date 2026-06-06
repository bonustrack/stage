/** CoinGecko token-price helper. Mirrors `apps/ui/src/helpers/coingecko.ts`
 *  in sx-monorepo, trimmed to the price-lookup path Metro needs. Uses the
 *  Snapshot UI's CG Pro key so we don't burn a separate quota; the wallet tab
 *  reads ETH + a couple of ERC-20s, which is well inside the limits.
 *
 *  Pro endpoint is `pro-api.coingecko.com` (with `x_cg_pro_api_key` query
 *  param). Public/demo endpoints differ in URL and rate limits, so keep the
 *  Pro URL for parity with sx-monorepo.
 *
 *  Pure `fetch`, no platform deps. The default key can be overridden by passing
 *  `apiKey` (the Stage client threads its `apiKeys.coingecko` through here). */

const CG_KEY = 'CG-o41PzYqjLPSWSJdMEyDELEpB';
const CG_URL = 'https://pro-api.coingecko.com/api/v3/simple';

export interface CgPrice {
  usd: number;
  usd_24h_change: number;
}

/** Fetch USD prices for a set of ERC-20 contracts on the given platform
 *  (`ethereum`, `polygon-pos`, ...). Returns a contract->price map; missing
 *  contracts simply don't appear in the result. */
export async function getErc20UsdPrices(
  platform: string,
  contracts: string[],
  apiKey: string = CG_KEY,
): Promise<Record<string, CgPrice>> {
  if (contracts.length === 0) return {};
  const url = `${CG_URL}/token_price/${platform}?contract_addresses=${contracts
    .map(c => c.toLowerCase())
    .join(',')}&vs_currencies=usd&include_24hr_change=true&x_cg_pro_api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  return res.json();
}

/** Fetch a "simple price" by CoinGecko coin id (ETH = `ethereum`).
 *  Returns the price record keyed by the id. */
export async function getSimplePrices(
  ids: string[],
  apiKey: string = CG_KEY,
): Promise<Record<string, CgPrice>> {
  if (ids.length === 0) return {};
  const url = `${CG_URL}/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&x_cg_pro_api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  return res.json();
}
