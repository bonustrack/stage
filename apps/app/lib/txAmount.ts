/** @file Dependency-free decimal-string -> base-units amount parse/validation for on-chain sends, separate from lib/tx.ts for isolated testing; validates the EXACT string `parseUnits` consumes (rejecting float forms and excess precision) so the guard and the signed value never disagree. */

import { parseUnits } from 'viem';

/** Parse a human-readable decimal `amount` into base units, rejecting any invalid or non-positive value with a clean error. */
export function parseAmount(amount: string, decimals: number): bigint {
  const trimmed = typeof amount === 'string' ? amount.trim() : '';
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid amount');
  }
  /** Reject more fraction digits than the token supports — viem's `parseUnits` silently ROUNDS excess precision, making the signed value differ from what the user typed; fail cleanly instead. */
  const frac = trimmed.split('.')[1] ?? '';
  if (frac.length > decimals) throw new Error('Invalid amount');
  let value: bigint;
  try {
    value = parseUnits(trimmed, decimals);
  } catch {
    throw new Error('Invalid amount');
  }
  if (value <= 0n) throw new Error('Invalid amount');
  return value;
}
