/** Re-export shim: OpenSea v2 NFT helper moved into the framework-agnostic
 *  Stage SDK (@stage-labs/client). Kept here so existing app imports stay
 *  stable. EXPO_PUBLIC_OPENSEA_API_KEY still overrides the default read key. */
export {
  getNftsAcrossChains,
  type Nft,
} from '@stage-labs/client/api/opensea';
