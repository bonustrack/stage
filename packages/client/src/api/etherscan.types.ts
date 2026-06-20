/** @file Shared EtherscanTx boundary type, extracted so the fetch helper (etherscan.ts) and its zod schema (etherscan.schema.ts) can both reference it without forming an import cycle. */

/** Raw Etherscan `txlist` row (subset we render). All numeric fields arrive as decimal strings. */
export interface EtherscanTx {
  hash: string;
  nonce: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string; /** wei */
  isError: string; /** "0" ok, "1" failed */
  functionName?: string;
  input: string; /** "0x" = plain transfer */
  gasUsed: string;
  gasPrice: string;
}
