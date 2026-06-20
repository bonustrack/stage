
const CG_KEY = 'CG-o41PzYqjLPSWSJdMEyDELEpB';
const CG_URL = 'https://pro-api.coingecko.com/api/v3/simple';

export interface CgPrice {
  usd: number;
  usd_24h_change: number;
}

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
  return (await res.json()) as Record<string, CgPrice>;
}

export async function getSimplePrices(
  ids: string[],
  apiKey: string = CG_KEY,
): Promise<Record<string, CgPrice>> {
  if (ids.length === 0) return {};
  const url = `${CG_URL}/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&x_cg_pro_api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  return (await res.json()) as Record<string, CgPrice>;
}
