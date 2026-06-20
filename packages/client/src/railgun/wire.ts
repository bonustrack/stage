/** @file PURE bigint wire-encoding for the Railgun bridge: the JSON channel can't carry a bigint, so every bigint arg is wrapped as { __bigint: "<decimal>" } on the way out and the Node host's dispatcher revives it before invoking the SDK, keeping the commitment math intact. */

/** The on-wire marker for a bigint value the host must revive. */
export interface BigIntWire {
  __bigint: string;
}

/** Wrap a bigint (or decimal-string wei) as the wire marker the host revives. */
export function bn(value: bigint | string): BigIntWire {
  return { __bigint: typeof value === 'bigint' ? value.toString() : value };
}
