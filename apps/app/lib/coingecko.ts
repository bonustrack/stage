/** Re-export shim: CoinGecko price helper moved into the framework-agnostic
 *  Stage SDK (@stage-labs/client). Kept here so existing app imports stay
 *  stable. The default CG Pro key still applies when no key is passed. */
export { getSimplePrices } from '@stage-labs/client/api/coingecko';
