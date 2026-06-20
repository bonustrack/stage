
export interface EtherscanTx {
  hash: string;
  nonce: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError: string;
  functionName?: string;
  input: string;
  gasUsed: string;
  gasPrice: string;
}
