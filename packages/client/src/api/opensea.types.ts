/** Shared OpenSea boundary types. Extracted into its own module so the fetch
 *  helper (opensea.ts) and the zod boundary schema (opensea.schema.ts) can both
 *  reference `ApiNft` without importing each other — which would form an import
 *  cycle (opensea.ts → opensea.schema.ts → opensea.ts). */

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
