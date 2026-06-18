/** Zod boundary schema for the OpenSea v2 NFTs-by-account response.
 *
 *  The response is `{ nfts: ApiNft[] }`. NFT fields vary wildly across
 *  collections, so the per-NFT schema is loose (optional, with sane defaults
 *  the caller already applies). We mainly assert the top-level envelope is the
 *  expected shape; on drift the boundary helper logs and the caller degrades to
 *  an empty grid rather than rendering garbage. */

import { z } from 'zod';
import { parseOrNull } from '../validate';
import type { ApiNft } from './opensea.types';

const nftSchema = z.object({
  identifier: z.string().default(''),
  collection: z.string().default(''),
  contract: z.string().default(''),
  token_standard: z.string().default(''),
  name: z.string().default(''),
  image_url: z.string().default(''),
  opensea_url: z.string().default(''),
});

const responseSchema = z.object({
  nfts: z.array(nftSchema).optional(),
});

export interface OpenseaResponse {
  nfts?: ApiNft[];
}

/** Validate a raw OpenSea response body. Returns null (after logging) when the
 *  envelope is malformed, so the caller can degrade to []. */
export function parseOpenseaResponse(data: unknown): OpenseaResponse | null {
  return parseOrNull('api.opensea', responseSchema, data) as OpenseaResponse | null;
}
