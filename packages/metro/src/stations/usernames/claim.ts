// Server-side claim validation for the Stage username gateway.
//
// Re-runs the SHARED name rules (charset/length/reserved) and recovers the
// signer from the EIP-191 signature, rejecting if it doesn't match the claimed
// address or if the timestamp is stale/future. Rules + message mirror the SDK
// (./username-spec) so client and gateway never drift.

import { type Hex, verifyMessage, isAddress } from 'viem';
import {
  claimMessage, validateName, normalizeName, nameErrorMessage,
  type UsernameRecord,
} from './username-spec.js';

/** Max age of a claim signature (seconds) — and small future skew tolerance. */
const MAX_AGE = 600;
const FUTURE_SKEW = 60;

export interface ClaimBody {
  name?: unknown;
  address?: unknown;
  avatar?: unknown;
  sig?: unknown;
  ts?: unknown;
}

export type Validated =
  | { ok: true; record: UsernameRecord }
  | { ok: false; status: number; error: string };

/** Validate + verify a POST /claim body. Pure (no store access) so the server
 *  can decide first-come ownership separately. */
export async function validateClaim(body: ClaimBody): Promise<Validated> {
  const rawName = typeof body.name === 'string' ? body.name : '';
  const address = typeof body.address === 'string' ? body.address.toLowerCase() : '';
  const sig = typeof body.sig === 'string' ? (body.sig as Hex) : ('' as Hex);
  const ts = typeof body.ts === 'number' ? body.ts : NaN;
  const avatar = typeof body.avatar === 'string' && body.avatar ? body.avatar : undefined;

  const name = normalizeName(rawName);
  const nameErr = validateName(name);
  if (nameErr) return { ok: false, status: 400, error: nameErrorMessage(nameErr) };
  if (!isAddress(address)) return { ok: false, status: 400, error: 'bad address' };
  if (!sig.startsWith('0x') || sig.length < 132) return { ok: false, status: 400, error: 'bad signature' };
  if (!Number.isFinite(ts)) return { ok: false, status: 400, error: 'bad ts' };

  const now = Math.floor(Date.now() / 1000);
  if (ts > now + FUTURE_SKEW) return { ok: false, status: 400, error: 'ts in the future' };
  if (ts < now - MAX_AGE) return { ok: false, status: 400, error: 'signature expired' };

  const message = claimMessage(name, address, ts);
  let valid = false;
  try {
    valid = await verifyMessage({ address: address as Hex, message, signature: sig });
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, status: 401, error: 'signature does not match address' };

  return { ok: true, record: { name, address, avatar, sig, ts } };
}
