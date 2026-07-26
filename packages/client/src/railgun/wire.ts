
export interface BigIntWire {
  __bigint: string;
}

export function bn(value: bigint | string): BigIntWire {
  return { __bigint: typeof value === 'bigint' ? value.toString() : value };
}

export interface RailgunGasDetails {
  evmGasType: 0 | 1 | 2;
  gasEstimate: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

export interface RailgunErc20Recipient {
  tokenAddress: string;
  amountWei: string;
  recipientAddress: string;
}

export function wireRecipients(recipients: RailgunErc20Recipient[]): Record<string, unknown>[] {
  return recipients.map(r => ({
    tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
  }));
}

export function wireGasDetails(g: RailgunGasDetails): Record<string, unknown> {
  return {
    evmGasType: g.evmGasType,
    gasEstimate: bn(g.gasEstimate),
    maxFeePerGas: bn(g.maxFeePerGas),
    maxPriorityFeePerGas: bn(g.maxPriorityFeePerGas),
  };
}
