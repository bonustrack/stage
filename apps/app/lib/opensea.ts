/** Re-export shim: OpenSea v2 NFT helper moved into the framework-agnostic
 *  Stage SDK (@metro-labs/client). Kept here so existing app imports stay
 *  stable. EXPO_PUBLIC_OPENSEA_API_KEY still overrides the default read key. */
export {
  getNfts,
  getNftsAcrossChains,
  NFT_CHAIN_IDS,
  type Nft,
} from '@metro-labs/client/api/opensea';
