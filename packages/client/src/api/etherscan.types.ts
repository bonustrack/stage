/** Shared Etherscan boundary types. Extracted into its own module so the
 *  fetch helper (etherscan.ts) and the zod boundary schema (etherscan.schema.ts)
 *  can both reference `EtherscanTx` without importing each other — which would
 *  form an import cycle (etherscan.ts → etherscan.schema.ts → etherscan.ts). */

/** Raw Etherscan `txlist` row (subset we render). All numeric fields arrive
 *  as decimal strings. */
export interface EtherscanTx {
  hash: string;
  nonce: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string; // wei
  isError: string; // "0" ok, "1" failed
  functionName?: string;
  input: string; // "0x" = plain transfer
  gasUsed: string;
  gasPrice: string;
}
