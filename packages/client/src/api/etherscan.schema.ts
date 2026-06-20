
import { z } from 'zod';
import { parseOrThrow } from '../validate';
import type { EtherscanTx } from './etherscan.types';

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

export function parseEtherscanResponse(data: unknown): EtherscanResponse {
  return parseOrThrow('api.etherscan', responseSchema, data);
}
