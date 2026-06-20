
export interface BigIntWire {
  __bigint: string;
}

export function bn(value: bigint | string): BigIntWire {
  return { __bigint: typeof value === 'bigint' ? value.toString() : value };
}
