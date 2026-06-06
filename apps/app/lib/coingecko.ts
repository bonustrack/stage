/** Re-export shim: CoinGecko price helper moved into the framework-agnostic
 *  Stage SDK (@metro-labs/client). Kept here so existing app imports stay
 *  stable. The default CG Pro key still applies when no key is passed. */
export { getErc20UsdPrices, getSimplePrices, type CgPrice } from '@metro-labs/client/api/coingecko';
