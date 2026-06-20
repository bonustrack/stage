/** @file Shared ApiNft OpenSea boundary type in its own module so the fetch helper (opensea.ts) and the zod schema (opensea.schema.ts) can both reference it without forming an import cycle. */

/** Raw OpenSea v2 NFT row (subset we render). */
export interface ApiNft {
  identifier: string;
  collection: string;
  contract: string;
  token_standard: string;
  name: string;
  image_url: string;
  opensea_url: string;
}
