/**
 * @file Dependency-free decimal-string -> base-units amount parse/validation for on-chain sends, kept separate from lib/tx.ts so it is unit-testable in isolation.
 *  Validates the EXACT string `parseUnits` consumes (rejecting float-rounding forms like "1e3" and excess precision) before signing, so the guard and the signed value never disagree.
 */

import { parseUnits } from 'viem';

/** Parse a human-readable decimal `amount` into base units, rejecting any invalid or non-positive value with a clean error. */
export function parseAmount(amount: string, decimals: number): bigint {
  const trimmed = typeof amount === 'string' ? amount.trim() : '';
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid amount');
  }
  // Reject more fraction digits than the token supports — viem's `parseUnits`
  // silently ROUNDS excess precision, which would make the signed value differ
  // from what the user typed. Fail cleanly instead.
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
