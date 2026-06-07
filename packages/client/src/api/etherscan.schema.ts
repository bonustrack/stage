/** Zod boundary schema for the Etherscan v2 `txlist` response envelope.
 *
 *  Etherscan returns `{ status, message, result }` where `result` is either the
 *  tx rows (status "1") or an explanatory string (status "0" / errors). We
 *  validate ONLY the envelope shape here (the rows are mapped + coerced by the
 *  caller, which already tolerates missing fields); a body that isn't even this
 *  shape is real drift and throws loudly via the boundary helper. */

import { z } from 'zod';
import { parseOrThrow } from '../validate';
import type { EtherscanTx } from './etherscan';

/** A single txlist row. All numeric fields arrive as decimal strings; optional
 *  fields are kept loose since the caller defaults them. */
const txSchema = z.object({
  hash: z.string(),
  nonce: z.string(),
  timeStamp: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  isError: z.string(),
  functionName: z.string().optional(),
  input: z.string(),
  gasUsed: z.string(),
  gasPrice: z.string(),
});

/** The response envelope: `result` is rows OR an explanatory string. */
const responseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.union([z.array(txSchema), z.string()]),
});

export interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanTx[] | string;
}

/** Validate a raw Etherscan response body. Throws (with a logged reason) when
 *  the envelope itself is malformed. */
export function parseEtherscanResponse(data: unknown): EtherscanResponse {
  return parseOrThrow('api.etherscan', responseSchema, data) as EtherscanResponse;
}
