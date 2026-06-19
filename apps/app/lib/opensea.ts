/** @file Re-export shim for the OpenSea v2 cross-chain NFT helper, now living in `@stage-labs/client`, keeping existing app import paths stable. */
export {
  getNftsAcrossChains,
  type Nft,
} from '@stage-labs/client/api/opensea';
