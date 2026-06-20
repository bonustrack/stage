
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

export function parseOpenseaResponse(data: unknown): OpenseaResponse | null {
  return parseOrNull('api.opensea', responseSchema, data) as OpenseaResponse | null;
}
