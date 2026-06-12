/** Dependency-free amount validation for on-chain sends.
 *
 *  Kept separate from `lib/tx.ts` (which pulls wagmi / react-native) so the
 *  pure decimal-string -> base-units parse can be unit-tested in isolation.
 *
 *  Why not `Number(amount)`: floats silently round very small / high-precision
 *  values (so the guard and the signed value disagree) and accept forms like
 *  "1e3" that `parseUnits` then rejects with a confusing low-level error. We
 *  validate the EXACT decimal string `parseUnits` consumes, before signing. */

import { parseUnits } from 'viem';

/** Parse a human-readable decimal `amount` into base units, rejecting any
 *  invalid or non-positive value with a clean error. */
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
